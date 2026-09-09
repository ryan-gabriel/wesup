// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import MarketplaceResults from "@/components/marketplace/MarketplaceResults";
import { renderComponent as render } from "./test-utils";

const ITEM: MarketplaceItem = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Cabai live",
  supplierName: "Supplier Bandung",
  category: "Sayur & Buah",
  imageUrl: "/file.svg",
  distanceKm: 2,
  estimatedPickupMinutes: 6,
  basePrice: 25000,
  currentTierPrice: 22000,
  registeredQuantity: 4,
  targetQuantity: 10,
  status: "ACTIVE",
  registrationClosesAt: "2099-09-15T10:00:00.000Z",
  pickupLatitude: -6.91,
  pickupLongitude: 107.61,
  pickupAddress: "Jl. Asia Afrika",
};

function props() {
  return {
    items: [] as readonly MarketplaceItem[],
    total: 0,
    loading: true,
    error: null as string | null,
    hasActiveFilters: false,
    currentPage: 1,
    totalPages: 1,
    onPageChange: vi.fn(),
    onRetry: vi.fn(),
    onReset: vi.fn(),
  };
}

describe("Marketplace UI state transitions", () => {
  it("moves from skeleton to cards, empty, and retryable error", () => {
    const view = render(<MarketplaceResults {...props()} />);
    expect(screen.getByRole("region", { hidden: true })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/memuat penawaran/i)).toBeInTheDocument();

    view.rerender(<MarketplaceResults {...props()} loading={false} items={[ITEM]} total={1} />);
    expect(screen.getByText("Cabai live")).toBeInTheDocument();

    view.rerender(<MarketplaceResults {...props()} loading={false} />);
    expect(screen.getByText("Barang tidak ditemukan")).toBeInTheDocument();

    view.rerender(<MarketplaceResults {...props()} loading={false} error="Server sedang sibuk" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Server sedang sibuk");
    expect(screen.getByRole("button", { name: /coba lagi/i })).toBeInTheDocument();
  });
});
