// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MarketplaceFilters from "@/components/marketplace/MarketplaceFilters";
import { BATCH_CATEGORIES, SEARCH_DEFAULT_RADIUS_KM } from "@/lib/catalog/categories";
import type { MarketplaceFilterValue } from "@/lib/marketplace/types";
import type { MarketplaceFilterErrors } from "@/lib/marketplace/query";
import { renderComponent as render } from "./test-utils";

function defaultProps(overrides: Partial<MarketplaceFilterValue> & { errors?: MarketplaceFilterErrors; onChange?: (value: MarketplaceFilterValue) => void } = {}) {
  return {
    idPrefix: "desktop" as const,
    value: {
      selectedCategories: overrides.selectedCategories ?? [],
      minPrice: overrides.minPrice ?? null,
      maxPrice: overrides.maxPrice ?? null,
      radiusKm: overrides.radiusKm ?? SEARCH_DEFAULT_RADIUS_KM,
    },
    errors: overrides.errors ?? {},
    onChange: overrides.onChange ?? vi.fn(),
  };
}

describe("MarketplaceFilters", () => {
  describe("category checkboxes", () => {
    it("renders all batch categories", () => {
      render(<MarketplaceFilters {...defaultProps()} />);
      for (const cat of BATCH_CATEGORIES) {
        expect(screen.getByText(cat)).toBeInTheDocument();
      }
    });

    it("marks selected categories as checked", () => {
      render(<MarketplaceFilters {...defaultProps({ selectedCategories: ["Sayur & Buah"] })} />);
      const checkbox = screen.getByRole("checkbox", { name: /sayur & buah/i });
      expect(checkbox).toBeChecked();
    });

    it("unselected categories are not checked", () => {
      render(<MarketplaceFilters {...defaultProps()} />);
      for (const cat of BATCH_CATEGORIES) {
        expect(screen.getByRole("checkbox", { name: new RegExp(cat, "i") })).not.toBeChecked();
      }
    });

    it("calls onChange with toggled category when clicking an unchecked category", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<MarketplaceFilters {...defaultProps({ onChange })} />);
      await user.click(screen.getByRole("checkbox", { name: /kerajinan/i }));
      expect(onChange).toHaveBeenCalledTimes(1);
      const newValue = onChange.mock.calls[0][0] as MarketplaceFilterValue;
      expect(newValue.selectedCategories).toContain("Kerajinan");
    });

    it("calls onChange with category removed when clicking a checked category", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<MarketplaceFilters {...defaultProps({ selectedCategories: ["Kerajinan"], onChange })} />);
      await user.click(screen.getByRole("checkbox", { name: /kerajinan/i }));
      expect(onChange).toHaveBeenCalledTimes(1);
      const newValue = onChange.mock.calls[0][0] as MarketplaceFilterValue;
      expect(newValue.selectedCategories).not.toContain("Kerajinan");
    });
  });

  describe("radius slider", () => {
    it("renders a range input for radius", () => {
      render(<MarketplaceFilters {...defaultProps()} />);
      expect(screen.getByRole("slider", { name: /radius jarak/i })).toBeInTheDocument();
    });

    it("displays the current radius value", () => {
      render(<MarketplaceFilters {...defaultProps({ radiusKm: 20 })} />);
      expect(screen.getByText("20 km")).toBeInTheDocument();
    });

    it("calls onChange when radius is changed", async () => {
      const onChange = vi.fn();
      render(<MarketplaceFilters {...defaultProps({ onChange })} />);
      const slider = screen.getByRole("slider", { name: /radius jarak/i });
      fireEvent.change(slider, { target: { value: "30" } });
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("price range inputs", () => {
    it("renders min and max price inputs", () => {
      render(<MarketplaceFilters {...defaultProps()} />);
      expect(screen.getByRole("spinbutton", { name: /harga minimum/i })).toBeInTheDocument();
      expect(screen.getByRole("spinbutton", { name: /harga maksimum/i })).toBeInTheDocument();
    });

    it("shows placeholder text for empty price fields", () => {
      render(<MarketplaceFilters {...defaultProps()} />);
      expect(screen.getByPlaceholderText("Min")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Maks")).toBeInTheDocument();
    });

    it("displays current minPrice value", () => {
      render(<MarketplaceFilters {...defaultProps({ minPrice: 10000 })} />);
      expect(screen.getByRole("spinbutton", { name: /harga minimum/i })).toHaveValue(10000);
    });

    it("displays current maxPrice value", () => {
      render(<MarketplaceFilters {...defaultProps({ maxPrice: 50000 })} />);
      expect(screen.getByRole("spinbutton", { name: /harga maksimum/i })).toHaveValue(50000);
    });
  });

  describe("error display", () => {
    it("shows error message when minPrice error exists", () => {
      render(<MarketplaceFilters {...defaultProps({ errors: { minPrice: "Harga minimum tidak boleh negatif." } })} />);
      expect(screen.getByText("Harga minimum tidak boleh negatif.")).toBeInTheDocument();
    });

    it("shows error message when priceRange error exists", () => {
      render(<MarketplaceFilters {...defaultProps({ errors: { priceRange: "Harga minimum tidak boleh lebih besar dari harga maksimum." } })} />);
      expect(screen.getByText("Harga minimum tidak boleh lebih besar dari harga maksimum.")).toBeInTheDocument();
    });

    it("sets aria-invalid on inputs with errors", () => {
      render(<MarketplaceFilters {...defaultProps({ errors: { minPrice: "Error" } })} />);
      expect(screen.getByRole("spinbutton", { name: /harga minimum/i })).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("accessibility", () => {
    it("each category checkbox has an associated label", () => {
      render(<MarketplaceFilters {...defaultProps()} />);
      for (const cat of BATCH_CATEGORIES) {
        const checkbox = screen.getByRole("checkbox", { name: new RegExp(cat, "i") });
        expect(checkbox).toHaveAccessibleName();
      }
    });

    it("filter sections use fieldset and legend", () => {
      const { container } = render(<MarketplaceFilters {...defaultProps()} />);
      const fieldsets = container.querySelectorAll("fieldset");
      expect(fieldsets.length).toBeGreaterThanOrEqual(3);
    });
  });
});
