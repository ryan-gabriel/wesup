import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getDetail } from "@/app/api/marketplace/[id]/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

const BATCH_ID = "44444444-4444-4444-8444-444444444444";

const ROW = {
  id: BATCH_ID,
  supplier_name: "Supplier Bandung",
  title: "Cabai Merah Premium",
  description: "Cabai segar",
  category: "Sayur & Buah",
  min_quantity: 50,
  product_photo_url: null,
  pickup_address: "Jl. Asia Afrika",
  latitude: -6.95,
  longitude: 107.7,
  tiers: [
    { tier_number: 1, min_volume: 1, max_volume: 49, price_per_unit: 25000 },
    { tier_number: 2, min_volume: 50, max_volume: null, price_per_unit: 22000 },
  ],
  registered_quantity: 30,
  current_price_per_unit: 25000,
  registration_closes_at: "2026-09-15T10:00:00.000Z",
  distance_km: 2.5,
  total_count: 1,
};

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function buildClient(options: { rows?: unknown[]; error?: Error | null } = {}) {
  const rpc = vi.fn(async () => ({
    data: options.rows ?? [ROW],
    error: options.error ?? null,
  }));
  const client = { rpc };
  mockGetServerClient.mockResolvedValue(client as never);
  return { rpc };
}

describe("GET /api/marketplace/[id]", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("rejects an invalid UUID before touching the database", async () => {
    const res = await getDetail(new Request("http://localhost"), routeParams("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(mockGetServerClient).not.toHaveBeenCalled();
  });

  it("returns 404 when the published read model has no row", async () => {
    buildClient({ rows: [] });
    const res = await getDetail(new Request("http://localhost"), routeParams(BATCH_ID));
    expect(res.status).toBe(404);
  });

  it("returns 500 when the read model fails", async () => {
    buildClient({ error: new Error("db down") });
    const res = await getDetail(new Request("http://localhost"), routeParams(BATCH_ID));
    expect(res.status).toBe(500);
  });

  it("returns the same canonical item shape as the listing", async () => {
    const { rpc } = buildClient();
    const res = await getDetail(new Request("http://localhost/api/marketplace"), routeParams(BATCH_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: BATCH_ID,
      supplierName: "Supplier Bandung",
      registeredQuantity: 30,
      targetQuantity: 50,
      currentTierPrice: 25000,
      registrationClosesAt: "2026-09-15T10:00:00.000Z",
    });
    expect(body.slug).toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("get_marketplace_batch", {
      p_batch_id: BATCH_ID,
      p_lat: null,
      p_lng: null,
    });
  });

  it("forwards valid viewer coordinates for distance display", async () => {
    const { rpc } = buildClient();
    const res = await getDetail(
      new Request("http://localhost/api/marketplace/[id]?lat=-6.9&lng=107.6"),
      routeParams(BATCH_ID),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("get_marketplace_batch", {
      p_batch_id: BATCH_ID,
      p_lat: -6.9,
      p_lng: 107.6,
    });
  });

  it("rejects incomplete or out-of-range coordinates", async () => {
    buildClient();
    expect(
      (await getDetail(new Request("http://localhost/api/marketplace/[id]?lat=-6.9"), routeParams(BATCH_ID))).status,
    ).toBe(400);
    expect(
      (await getDetail(new Request("http://localhost/api/marketplace/[id]?lat=91&lng=107.6"), routeParams(BATCH_ID))).status,
    ).toBe(400);
  });
});
