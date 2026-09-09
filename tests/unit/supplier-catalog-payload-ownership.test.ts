import { describe, expect, it } from "vitest";
import { parseSupplierCatalogPayload } from "@/lib/supplier-catalog/api";

const payload = {
  title: "Beras", category: "Makanan Siap Saji", description: "Beras UMKM", targetQuantity: 50,
  pickupName: "Gudang", pickupAddress: "Bandung", pickupLatitude: -6.9175, pickupLongitude: 107.6191,
  registrationOpensAt: "2099-01-01T00:00:00.000Z", registrationClosesAt: "2099-01-02T00:00:00.000Z",
  paymentOpensAt: "2099-01-02T01:00:00.000Z", paymentClosesAt: "2099-01-03T00:00:00.000Z", estimatedReadyAt: "2099-01-04T00:00:00.000Z",
  tiers: [{ tierNumber: 1, minimumQuantity: 1, maximumQuantity: 49, pricePerUnit: 10000 }, { tierNumber: 2, minimumQuantity: 50, maximumQuantity: null, pricePerUnit: 9000 }],
};

describe("supplier catalog payload ownership", () => {
  it("rejects a top-level supplierId rather than accepting a client owner", () => {
    expect(parseSupplierCatalogPayload({ ...payload, supplierId: "attacker" })).toBeNull();
  });
});
