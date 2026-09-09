// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import MarketplaceResults from "@/components/marketplace/MarketplaceResults";
import { renderComponent as render } from "./test-utils";

const MOCK_ITEMS: MarketplaceItem[] = [
  {
    id: "item-1",
    title: "Cabai Merah",
    supplierName: "Mitra 1",
    category: "Sayur & Buah",
    imageUrl: "/img1.webp",
    distanceKm: 2,
    estimatedPickupMinutes: 15,
    basePrice: 20000,
    currentTierPrice: 18000,
    registeredQuantity: 10,
    targetQuantity: 20,
    status: "ACTIVE",
    registrationClosesAt: "2026-09-10T10:00:00.000Z",
    pickupLatitude: -6.9175,
    pickupLongitude: 107.6191,
    pickupAddress: "Jl. Asia Afrika No. 43, Bandung",
  },
  {
    id: "item-2",
    title: "Ikan Gurame",
    supplierName: "Mitra 2",
    category: "Daging & Ikan",
    imageUrl: "/img2.webp",
    distanceKm: 5,
    estimatedPickupMinutes: 30,
    basePrice: 45000,
    currentTierPrice: 42000,
    registeredQuantity: 8,
    targetQuantity: 15,
    status: "ACTIVE",
    registrationClosesAt: "2026-09-12T10:00:00.000Z",
    pickupLatitude: -6.8917,
    pickupLongitude: 107.6026,
    pickupAddress: "Jl. Dago No. 45, Bandung",
  },
];

function baseProps() {
  return {
    items: [] as readonly MarketplaceItem[],
    total: 0,
    loading: false,
    error: null as string | null,
    hasActiveFilters: false,
    currentPage: 1,
    totalPages: 1,
    onPageChange: vi.fn(),
    onRetry: vi.fn(),
    onReset: vi.fn(),
  };
}

describe("MarketplaceResults", () => {
  describe("loading state", () => {
    it("renders skeleton cards when loading with no items", () => {
      const { container } = render(<MarketplaceResults {...baseProps()} loading={true} />);
      const skeletons = container.querySelectorAll("[aria-hidden='true'].animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("sets aria-busy on the section", () => {
      render(<MarketplaceResults {...baseProps()} loading={true} />);
      const section = screen.getByRole("region", { hidden: true });
      expect(section).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("error state", () => {
    it("shows the error message", () => {
      render(<MarketplaceResults {...baseProps()} error="Server error" />);
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    it("shows a retry button that calls onRetry", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      render(<MarketplaceResults {...baseProps()} error="timeout" onRetry={onRetry} />);
      await user.click(screen.getByRole("button", { name: /coba lagi/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("empty state", () => {
    it("shows empty message when no items and no filters", () => {
      render(<MarketplaceResults {...baseProps()} hasActiveFilters={false} />);
      expect(screen.getByText(/barang tidak ditemukan/i)).toBeInTheDocument();
    });

    it("shows empty message when no items but has active filters", () => {
      render(<MarketplaceResults {...baseProps()} hasActiveFilters={true} />);
      expect(screen.getByText(/barang tidak ditemukan/i)).toBeInTheDocument();
    });

    it("does not show reset button when no active filters", () => {
      render(<MarketplaceResults {...baseProps()} hasActiveFilters={false} />);
      expect(screen.queryByRole("button", { name: /reset filter/i })).not.toBeInTheDocument();
    });

    it("shows reset button when has active filters", async () => {
      const user = userEvent.setup();
      const onReset = vi.fn();
      render(<MarketplaceResults {...baseProps()} hasActiveFilters={true} onReset={onReset} />);
      await user.click(screen.getByRole("button", { name: /reset filter/i }));
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe("success state with items", () => {
    it("renders product cards for each item", () => {
      render(<MarketplaceResults {...baseProps()} items={MOCK_ITEMS} total={2} />);
      expect(screen.getByText("Cabai Merah")).toBeInTheDocument();
      expect(screen.getByText("Ikan Gurame")).toBeInTheDocument();
    });

    it("renders links for each product card", () => {
      render(<MarketplaceResults {...baseProps()} items={MOCK_ITEMS} total={2} />);
      const links = screen.getAllByRole("link");
      expect(links.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("pagination", () => {
    it("renders pagination when totalPages > 1", () => {
      render(<MarketplaceResults {...baseProps()} items={MOCK_ITEMS} total={25} currentPage={1} totalPages={3} />);
      expect(screen.getByRole("navigation", { name: /pagination navigation/i })).toBeInTheDocument();
    });

    it("does not render pagination when only 1 page", () => {
      render(<MarketplaceResults {...baseProps()} items={MOCK_ITEMS} total={2} currentPage={1} totalPages={1} />);
      expect(screen.queryByRole("navigation", { name: /pagination navigation/i })).not.toBeInTheDocument();
    });

    it("calls onPageChange when next button is clicked", async () => {
      const user = userEvent.setup();
      const onPageChange = vi.fn();
      render(<MarketplaceResults {...baseProps()} items={MOCK_ITEMS} total={25} currentPage={1} totalPages={3} onPageChange={onPageChange} />);
      await user.click(screen.getByRole("button", { name: /next/i }));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });
});
