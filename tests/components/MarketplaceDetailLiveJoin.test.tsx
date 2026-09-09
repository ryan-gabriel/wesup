// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import MarketplaceDetailClient from "@/components/marketplace/MarketplaceDetailClient";
import { renderComponent as render } from "./test-utils";

const ITEM: MarketplaceItem = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Cabai Merah Premium",
  supplierName: "Mitra Tani Bandung",
  category: "Sayur & Buah",
  imageUrl: "/file.svg",
  distanceKm: 3,
  estimatedPickupMinutes: 9,
  basePrice: 25000,
  currentTierPrice: 22000,
  registeredQuantity: 30,
  targetQuantity: 50,
  status: "ACTIVE",
  registrationClosesAt: "2099-09-15T10:00:00.000Z",
  pickupLatitude: -6.9175,
  pickupLongitude: 107.6191,
  pickupAddress: "Jl. Asia Afrika No. 123, Bandung",
  tiers: [
    { tierNumber: 1, minVolume: 1, maxVolume: 49, pricePerUnit: 25000 },
    { tierNumber: 2, minVolume: 50, maxVolume: null, pricePerUnit: 22000 },
  ],
};

describe("MarketplaceDetailClient live registration", () => {
  it("updates the tier count immediately after the registration API succeeds", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/batches/") && url.endsWith("/progress")) {
        return new Response(
          JSON.stringify({
            batchId: ITEM.id,
            status: "published",
            registeredQuantity: 30,
            tiers: ITEM.tiers,
            tierProgress: {
              currentTierNumber: 1,
              currentPricePerUnit: 25000,
              nextTierNumber: 2,
              nextTierMinVolume: 50,
              remainingToNextTier: 20,
              progressPercent: 60,
            },
            registrationClosesAt: ITEM.registrationClosesAt,
            serverTime: new Date().toISOString(),
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: true, count: 35, registrationId: "reg-1" }), {
        status: 201,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MarketplaceDetailClient
        item={ITEM}
        canonicalUrl={`https://wesup.id/marketplace/${ITEM.id}`}
        viewerRole="umkm"
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /saya menyetujui lokasi/i }));
    await user.click(screen.getByRole("button", { name: /daftar sekarang/i }));

    await waitFor(() => {
      expect(screen.getByText("Target Kelompok: 35/50 Porsi")).toBeInTheDocument();
      expect(screen.getByText("70%")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/registrations", expect.objectContaining({ method: "POST" }));
  });
});
