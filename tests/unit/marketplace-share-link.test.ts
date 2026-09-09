import { describe, expect, it } from "vitest";
import { buildPublicMarketplaceUrl, buildWhatsAppShareUrl } from "@/lib/marketplace/share-link";
import type { MarketplaceItem } from "@/lib/marketplace/types";

const BATCH_ID = "44444444-4444-4444-8444-444444444444";
const ITEM: MarketplaceItem = {
  id: BATCH_ID,
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
};

describe("marketplace share links", () => {
  it("builds an absolute canonical URL without query or hash", () => {
    expect(buildPublicMarketplaceUrl(BATCH_ID, "https://wesup.id/base?ref=user-1#x")).toBe(
      `https://wesup.id/marketplace/${BATCH_ID}`,
    );
  });

  it("does not leak referral or UTM parameters into WhatsApp", () => {
    const url = buildWhatsAppShareUrl(
      ITEM,
      `https://wesup.id/marketplace/${BATCH_ID}?ref=user-1&utm_source=wa#tracking`,
    );
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("Cabai Merah Premium");
    expect(decoded).toContain(`https://wesup.id/marketplace/${BATCH_ID}`);
    expect(decoded).not.toMatch(/ref=|utm_|user-1|#tracking/i);
  });
});
