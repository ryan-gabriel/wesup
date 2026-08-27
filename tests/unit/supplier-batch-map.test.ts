import { describe, expect, it } from "vitest";
import { mapSupplierBatchRow } from "@/lib/supplier-batch/map";

const ROW = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Cabai Merah Keriting",
  description: "Grade A",
  category: "sayur",
  min_quantity: 50,
  product_photo_url: "https://example.com/cabai.webp",
  pickup_address: "Jl. Test No. 1, Bandung",
  latitude: -6.9,
  longitude: 107.6,
  status: "published",
  cancelled_reason: null,
  updated_at: "2030-01-06T00:00:00.000Z",
  batch_tiers: [
    { tier_number: 2, min_volume: 100, max_volume: 200, price_per_unit: 35000 },
    { tier_number: 1, min_volume: 1, max_volume: null, price_per_unit: 40000 },
  ],
  batch_timeline: {
    registration_opens_at: "2030-01-01T00:00:00.000Z",
    registration_closes_at: "2030-01-02T00:00:00.000Z",
    payment_opens_at: "2030-01-02T01:00:00.000Z",
    payment_closes_at: "2030-01-03T00:00:00.000Z",
    estimated_ready_at: "2030-01-05T00:00:00.000Z",
  },
};

const COUNTS = { participantCount: 12, paidParticipantCount: 5, registeredQuantity: 30 };

describe("mapSupplierBatchRow", () => {
  it("maps database rows into the supplier detail view model", () => {
    const detail = mapSupplierBatchRow(ROW, COUNTS);
    expect(detail.id).toBe(ROW.id);
    expect(detail.title).toBe(ROW.title);
    expect(detail.status).toBe("PUBLISHED");
    expect(detail.cancellation).toBeNull();
    expect(detail.basePrice).toBe(40000);
    expect(detail.targetQuantity).toBe(50);
    expect(detail.registeredQuantity).toBe(30);
    expect(detail.participantCount).toBe(12);
    expect(detail.paidParticipantCount).toBe(5);
    expect(detail.tiers).toEqual([
      { tierNumber: 1, minimumQuantity: 1, maximumQuantity: null, pricePerUnit: 40000 },
      { tierNumber: 2, minimumQuantity: 100, maximumQuantity: 200, pricePerUnit: 35000 },
    ]);
    expect(detail.timeline.registrationOpensAt).toBe("2030-01-01T00:00:00.000Z");
    expect(detail.pickup.address).toBe("Jl. Test No. 1, Bandung");
    expect(detail.imageUrl).toBe("https://example.com/cabai.webp");
  });

  it("maps a cancelled batch to CANCELLED_BY_SUPPLIER with cancellation info", () => {
    const detail = mapSupplierBatchRow(
      { ...ROW, status: "cancelled", cancelled_reason: "Gagal panen" },
      COUNTS,
    );
    expect(detail.status).toBe("CANCELLED_BY_SUPPLIER");
    expect(detail.cancellation).toEqual({
      reason: "Gagal panen",
      actor: "SUPPLIER",
      cancelledAt: "2030-01-06T00:00:00.000Z",
    });
  });

  it("fills safe defaults for optional fields", () => {
    const detail = mapSupplierBatchRow(
      { ...ROW, description: null, product_photo_url: null, batch_tiers: [] },
      { participantCount: 0, paidParticipantCount: 0, registeredQuantity: 0 },
    );
    expect(detail.description).toBe("");
    expect(detail.imageUrl).toBe("");
    expect(detail.basePrice).toBe(0);
  });
});
