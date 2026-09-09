import { describe, expect, it } from "vitest";
import {
  BANDUNG_CATALOG_RADIUS_KM,
  validateCatalogMutation,
  type CatalogMutationInput,
} from "@/lib/supplier-catalog/validation";

const validInput = (): CatalogMutationInput => ({
  title: "Beras Rojolele",
  category: "Makanan Siap Saji",
  description: "Beras untuk kebutuhan UMKM Bandung.",
  targetQuantity: 50,
  pickupName: "Gudang Bandung",
  pickupAddress: "Jl. Asia Afrika No. 1, Bandung",
  pickupLatitude: -6.9175,
  pickupLongitude: 107.6191,
  registrationOpensAt: "2099-01-01T01:00:00.000Z",
  registrationClosesAt: "2099-01-02T01:00:00.000Z",
  paymentOpensAt: "2099-01-02T02:00:00.000Z",
  paymentClosesAt: "2099-01-03T02:00:00.000Z",
  estimatedReadyAt: "2099-01-04T02:00:00.000Z",
  tiers: [
    { tierNumber: 1, minimumQuantity: 1, maximumQuantity: 49, pricePerUnit: 75_000 },
    { tierNumber: 2, minimumQuantity: 50, maximumQuantity: null, pricePerUnit: 68_000 },
  ],
  productPhotoUrl: null,
});

describe("supplier catalog mutation validation", () => {
  it("accepts a complete future Bandung catalog", () => {
    expect(validateCatalogMutation(validInput())).toEqual({ ok: true, value: validInput() });
  });

  it("rejects a target quantity that is not positive", () => {
    const result = validateCatalogMutation({ ...validInput(), targetQuantity: 0 });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    if (!result.ok) expect(result.fieldErrors.targetQuantity).toBeTruthy();
  });

  it("rejects tier price inversion and overlapping ranges", () => {
    const result = validateCatalogMutation({
      ...validInput(),
      tiers: [
        { tierNumber: 1, minimumQuantity: 1, maximumQuantity: 50, pricePerUnit: 70_000 },
        { tierNumber: 2, minimumQuantity: 50, maximumQuantity: null, pricePerUnit: 75_000 },
      ],
    });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    if (!result.ok) {
      expect(result.fieldErrors.tierInversion).toBeTruthy();
      expect(result.fieldErrors.tierOverlap).toBeTruthy();
    }
  });

  it("rejects non-linear or past timeline values", () => {
    const result = validateCatalogMutation({
      ...validInput(),
      registrationOpensAt: "2026-01-01T01:00:00.000Z",
      registrationClosesAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    if (!result.ok) expect(result.fieldErrors.timelineOrder).toBeTruthy();
  });

  it("rejects a pickup outside the configured Bandung radius", () => {
    const result = validateCatalogMutation({
      ...validInput(),
      pickupLatitude: -6.2,
      pickupLongitude: 107.6,
    });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    if (!result.ok) expect(result.fieldErrors.pickupCoordinate).toContain(String(BANDUNG_CATALOG_RADIUS_KM));
  });

  it("rejects a non-absolute existing product photo URL", () => {
    const result = validateCatalogMutation({ ...validInput(), productPhotoUrl: "/products/photo.webp" });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    if (!result.ok) expect(result.fieldErrors.productPhotoUrl).toBeTruthy();
  });
  it("requires at least two tiers", () => {
    const result = validateCatalogMutation({
      ...validInput(),
      tiers: [validInput().tiers[0]],
    });
    expect(result).toEqual(expect.objectContaining({ ok: false }));
    if (!result.ok) expect(result.fieldErrors.tiers).toBeTruthy();
  });
});
