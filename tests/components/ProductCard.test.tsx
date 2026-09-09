// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import ProductCard from "@/components/marketplace/ProductCard";
import { renderComponent as render } from "./test-utils";

const DEFAULT_ITEM: MarketplaceItem = {
  id: "item-1",
  title: "Cabai Merah Premium",
  supplierName: "Mitra Tani Bandung",
  category: "Sayur & Buah",
  imageUrl: "/images/cabai.webp",
  distanceKm: 3.5,
  estimatedPickupMinutes: 25,
  basePrice: 25000,
  currentTierPrice: 22000,
  registeredQuantity: 30,
  targetQuantity: 50,
  status: "ACTIVE",
  registrationClosesAt: "2026-09-15T10:00:00.000Z",
  pickupLatitude: -6.9175,
  pickupLongitude: 107.6191,
  pickupAddress: "Jl. Asia Afrika No. 123, Bandung",
};

function makeItem(overrides: Partial<MarketplaceItem> = {}): MarketplaceItem {
  return { ...DEFAULT_ITEM, ...overrides };
}

describe("ProductCard", () => {
  it("renders title and supplier name", () => {
    render(<ProductCard item={makeItem()} />);
    expect(screen.getByText("Cabai Merah Premium")).toBeInTheDocument();
    expect(screen.getByText("Mitra Tani Bandung")).toBeInTheDocument();
  });

  it("renders the category badge", () => {
    render(<ProductCard item={makeItem()} />);
    expect(screen.getByText("Sayur & Buah")).toBeInTheDocument();
  });

  it("formats currentTierPrice as IDR currency", () => {
    render(<ProductCard item={makeItem()} />);
    expect(screen.getByText(/Rp\s*22\.000/)).toBeInTheDocument();
  });

  it("renders basePrice with strikethrough", () => {
    render(<ProductCard item={makeItem()} />);
    const strikethrough = screen.getByText(/Rp\s*25\.000/);
    expect(strikethrough).toBeInTheDocument();
    expect(strikethrough.className).toContain("line-through");
  });

  it("shows distance in km with Indonesian formatting", () => {
    render(<ProductCard item={makeItem()} />);
    expect(screen.getByText("3,5 km")).toBeInTheDocument();
  });

  it("shows estimated pickup time", () => {
    render(<ProductCard item={makeItem()} />);
    expect(screen.getByText("25 mnt (Pickup)")).toBeInTheDocument();
  });

  it("shows the 'Tier Diskon' label", () => {
    render(<ProductCard item={makeItem()} />);
    expect(screen.getByText("Tier Diskon")).toBeInTheDocument();
  });

  it("shows progress bar with correct percentage", () => {
    render(<ProductCard item={makeItem()} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    const progressbar = screen.getByRole("progressbar", { name: /progres target kelompok/i });
    expect(progressbar).toHaveAttribute("aria-valuenow", "60");
  });

  it("calculates 0% progress when targetQuantity is 0", () => {
    render(<ProductCard item={makeItem({ registeredQuantity: 0, targetQuantity: 0 })} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("caps progress at 100% when registered exceeds target", () => {
    render(<ProductCard item={makeItem({ registeredQuantity: 200, targetQuantity: 50 })} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("links to the detail page using the batch UUID", () => {
    render(<ProductCard item={makeItem({ id: "44444444-4444-4444-8444-444444444444" })} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/marketplace/44444444-4444-4444-8444-444444444444");
  });

  it("is keyboard-focusable", async () => {
    const user = userEvent.setup();
    render(<ProductCard item={makeItem()} />);
    await user.tab();
    expect(screen.getByRole("link")).toHaveFocus();
  });
});
