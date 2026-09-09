// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import { renderComponent as render } from "./test-utils";
import MarketplaceRadiusMap from "@/components/marketplace/MarketplaceRadiusMap";

vi.mock("react-leaflet", () => {
  function Container({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) {
    return createElement("div", { "data-testid": "leaflet-container", ...props }, children);
  }
  function Layer({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) {
    return createElement("div", { ...props }, children);
  }
  return {
    MapContainer: Container,
    TileLayer: () => createElement("div", { "data-testid": "tile-layer" }),
    Circle: (props: { radius: number }) => createElement("div", { "data-testid": "radius-circle", "data-radius": String(props.radius) }),
    CircleMarker: Layer,
    Popup: ({ children }: { children?: ReactNode }) => createElement("div", { "data-testid": "popup" }, children),
  };
});

const ITEM = (overrides: Partial<MarketplaceItem> = {}): MarketplaceItem => ({
  id: "44444444-4444-4444-8444-444444444444",
  title: "Cabai Merah Premium",
  supplierName: "Supplier Bandung",
  category: "Sayur & Buah",
  imageUrl: "/file.svg",
  distanceKm: 2,
  estimatedPickupMinutes: 6,
  basePrice: 25000,
  currentTierPrice: 22000,
  registeredQuantity: 30,
  targetQuantity: 50,
  status: "ACTIVE",
  registrationClosesAt: "2026-09-15T10:00:00.000Z",
  pickupLatitude: -6.95,
  pickupLongitude: 107.7,
  pickupAddress: "Jl. Asia Afrika",
  ...overrides,
});

describe("MarketplaceRadiusMap", () => {
  it("draws the selected radius and only valid pickup coordinates", () => {
    render(
      <MarketplaceRadiusMap
        origin={{ latitude: -6.91, longitude: 107.61, source: "request" }}
        radiusKm={5}
        items={[ITEM(), ITEM({ id: "55555555-5555-4555-8555-555555555555", pickupLatitude: Number.NaN })]}
      />,
    );

    expect(screen.getByRole("region", { name: /radius 5 kilometer/i })).toBeInTheDocument();
    expect(screen.getByTestId("radius-circle")).toHaveAttribute("data-radius", "5000");
    expect(screen.getAllByText("Cabai Merah Premium")).toHaveLength(1);
    expect(screen.getByText("1 titik pickup")).toBeInTheDocument();
  });

  it("falls back to a one-kilometre circle for invalid radius input", () => {
    render(
      <MarketplaceRadiusMap
        origin={{ latitude: -6.91, longitude: 107.61, source: "bandung_default" }}
        radiusKm={Number.NaN}
        items={[]}
      />,
    );
    expect(screen.getByTestId("radius-circle")).toHaveAttribute("data-radius", "1000");
    expect(screen.getByText("Radius 1 km")).toBeInTheDocument();
  });
});
