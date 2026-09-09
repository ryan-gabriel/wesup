import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { GET as searchBatches } from "@/app/api/marketplace/search/route";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

const UMKM_ID = "55555555-5555-4555-8555-555555555555";
const BANDUNG = { latitude: -6.914744, longitude: 107.60981 };

interface SearchRow {
  id: string;
  title: string;
  total_count?: number;
  [key: string]: unknown;
}

function mockSearchClient(options: {
  rows?: SearchRow[];
  rpcError?: { code?: string; message?: string; details?: string; hint?: string } | null;
  user?:
    | { id: string; email?: string }
    | null;
  role?: string;
  profileCoords?: { latitude: number; longitude: number } | null;
}) {
  const getUser = vi.fn(async () =>
    options.user === undefined || options.user === null
      ? { data: { user: options.user ?? null }, error: null }
      : { data: { user: options.user }, error: null },
  );
  const profileSingle = vi.fn(async () => ({
    data:
      options.user === undefined || options.user === null
        ? null
        : {
            role: options.role ?? "umkm",
            status: "active",
            full_name: "Buyer",
          },
    error: null,
  }));
  const coordsMaybe = vi.fn(async () => ({
    data: options.profileCoords ?? null,
    error: null,
  }));
  const rpc = vi.fn(async (_method: string, _params: Record<string, unknown>) => ({
    data: (options.rows ?? []) as unknown[],
    error: options.rpcError ?? null,
  }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: profileSingle })),
        })),
      };
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybe: coordsMaybe })),
      })),
    };
  });
  const client = { auth: { getUser }, from, rpc };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, rpc, coordsMaybe };
}

function getReq(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/marketplace/search${query}`);
}

describe("GET /api/marketplace/search", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    vi.mocked(enforceRateLimit).mockReset();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
  });

  it("returns 429 when the rate limiter blocks the request", async () => {
    mockSearchClient({ rows: [], user: null });
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(
      NextResponse.json({ error: "rate_limited" }, { status: 429 }),
    );
    const res = await searchBatches(getReq(""));
    expect(res.status).toBe(429);
  });

  it("returns 200 with anonymous defaults: bandung center, radius 10, page 1", async () => {
    const rows: SearchRow[] = [
      { id: "b1", title: "Cabai", total_count: 1 },
    ];
    const { rpc } = mockSearchClient({ rows, user: null });
    const res = await searchBatches(getReq(""));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items[0]).toMatchObject({
      id: "b1",
      title: "Cabai",
      status: "ACTIVE",
      distanceKm: null,
      estimatedPickupMinutes: null,
    });
    expect(json).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 12,
      totalPages: 1,
      origin: {
        latitude: BANDUNG.latitude,
        longitude: BANDUNG.longitude,
        source: "bandung_default",
      },
    });
    expect(rpc).toHaveBeenCalledWith("search_batches", {
      p_query: null,
      p_categories: null,
      p_lat: BANDUNG.latitude,
      p_lng: BANDUNG.longitude,
      p_radius_km: 10,
      p_min_price: null,
      p_max_price: null,
      p_limit: 12,
      p_offset: 0,
    });
  });

  it("passes query, categories, coordinates and pagination through", async () => {
    const { rpc } = mockSearchClient({ rows: [], user: null });
    const res = await searchBatches(
      getReq(
        "?q=%20cabai%20&categories=Sayur%20%26%20Buah,Kerajinan&lat=-6.9&lng=107.6&radius=25&page=3",
      ),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      items: [],
      total: 0,
      page: 3,
      pageSize: 12,
      totalPages: 0,
      origin: { source: "request" },
    });
    expect(rpc).toHaveBeenCalledWith("search_batches", {
      p_query: "cabai",
      p_categories: ["Sayur & Buah", "Kerajinan"],
      p_lat: -6.9,
      p_lng: 107.6,
      p_radius_km: 25,
      p_min_price: null,
      p_max_price: null,
      p_limit: 12,
      p_offset: 24,
    });
  });

  it("clamps radius into the 1..50 km range", async () => {
    const { rpc } = mockSearchClient({ rows: [], user: null });
    await searchBatches(getReq("?radius=999"));
    expect((rpc.mock.calls[0][1] as Record<string, unknown>).p_radius_km).toBe(50);
    await searchBatches(getReq("?radius=0"));
    expect((rpc.mock.calls[1][1] as Record<string, unknown>).p_radius_km).toBe(1);
  });

  it("passes validated price bounds and maps a live RPC row to the canonical DTO", async () => {
    const rows: SearchRow[] = [
      {
        id: "b1",
        title: "Cabai",
        supplier_name: "Supplier Bandung",
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
      },
    ];
    const { rpc } = mockSearchClient({ rows, user: null });
    const res = await searchBatches(getReq("?minPrice=20000&maxPrice=30000"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      total: 1,
      pageSize: 12,
      totalPages: 1,
      origin: { source: "bandung_default" },
    });
    expect(json.items[0]).toMatchObject({
      id: "b1",
      supplierName: "Supplier Bandung",
      registeredQuantity: 30,
      registrationClosesAt: "2026-09-15T10:00:00.000Z",
      targetQuantity: 50,
      currentTierPrice: 25000,
      imageUrl: "/file.svg",
      estimatedPickupMinutes: 8,
    });
    expect(rpc).toHaveBeenCalledWith(
      "search_batches",
      expect.objectContaining({ p_min_price: 20000, p_max_price: 30000 }),
    );
  });

  it.each(["-1", "nope"])("rejects invalid minPrice %s", async (value) => {
    mockSearchClient({ rows: [], user: null });
    const res = await searchBatches(getReq(`?minPrice=${value}`));
    expect(res.status).toBe(400);
  });

  it("rejects an inverted price range", async () => {
    mockSearchClient({ rows: [], user: null });
    const res = await searchBatches(getReq("?minPrice=30000&maxPrice=20000"));
    expect(res.status).toBe(400);
  });

  it("falls back to the signed-in UMKM's stored business coordinates", async () => {
    const { rpc } = mockSearchClient({
      rows: [],
      user: { id: UMKM_ID },
      role: "umkm",
      profileCoords: { latitude: -6.95, longitude: 107.7 },
    });
    const res = await searchBatches(getReq(""));
    expect(res.status).toBe(200);
    const params = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(params.p_lat).toBe(-6.95);
    expect(params.p_lng).toBe(107.7);
  });

  it("uses bandung center when the stored profile has no coordinates", async () => {
    const { rpc } = mockSearchClient({
      rows: [],
      user: { id: UMKM_ID },
      role: "umkm",
      profileCoords: null,
    });
    await searchBatches(getReq(""));
    const params = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(params.p_lat).toBe(BANDUNG.latitude);
    expect(params.p_lng).toBe(BANDUNG.longitude);
  });

  it("returns 400 for an unknown category", async () => {
    mockSearchClient({ rows: [], user: null });
    const res = await searchBatches(getReq("?categories=Elektronik"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "unknown category: Elektronik",
    });
  });

  it("returns 400 when only one of lat/lng is provided", async () => {
    mockSearchClient({ rows: [], user: null });
    const res = await searchBatches(getReq("?lat=-6.9"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "lat and lng must be provided together",
    });
  });

  it("returns 400 for out-of-range coordinates", async () => {
    mockSearchClient({ rows: [], user: null });
    const res = await searchBatches(getReq("?lat=91&lng=107.6"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "lat must be between -90 and 90",
    });
  });

  it("returns 400 for a non-numeric radius", async () => {
    mockSearchClient({ rows: [], user: null });
    const res = await searchBatches(getReq("?radius=far"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "radius must be a number",
    });
  });

  it("returns 400 for an invalid limit or page", async () => {
    mockSearchClient({ rows: [], user: null });
    expect((await searchBatches(getReq("?limit=51"))).status).toBe(400);
    expect((await searchBatches(getReq("?limit=0"))).status).toBe(400);
    expect((await searchBatches(getReq("?page=0"))).status).toBe(400);
  });

  it("returns 500 when the rpc fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { rpc } = mockSearchClient({ rows: [], rpcError: { message: "boom" } });
      const res = await searchBatches(getReq(""));
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({
        error: "Penawaran belum dapat dimuat. Coba lagi.",
        code: "MARKETPLACE_QUERY_FAILED",
      });
      expect(log).toHaveBeenCalledWith(
        "[marketplace/search] search_batches failed",
        expect.objectContaining({ message: "boom" }),
      );
      expect(rpc).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("returns 503 with a safe code when the deployed RPC signature is outdated", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { rpc } = mockSearchClient({
        rows: [],
        rpcError: {
          code: "PGRST202",
          message: "Could not find the function public.search_batches(...) in the schema cache",
          hint: "Perhaps you meant search_batches(p_categories, p_lat, p_limit, p_lng, p_offset, p_query, p_radius_km)",
        },
      });
      const res = await searchBatches(getReq(""));
      expect(res.status).toBe(503);
      await expect(res.json()).resolves.toEqual({
        error: "Marketplace sedang disiapkan. Coba lagi sebentar.",
        code: "MARKETPLACE_SCHEMA_OUTDATED",
      });
      expect(rpc).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("accepts every allow-listed category", async () => {
    const { rpc } = mockSearchClient({ rows: [], user: null });
    const res = await searchBatches(
      getReq(
        "?categories=Sayur%20%26%20Buah,Daging%20%26%20Ikan,Makanan%20Siap%20Saji,Kerajinan,Jasa",
      ),
    );
    expect(res.status).toBe(200);
    expect((rpc.mock.calls[0][1] as Record<string, unknown>).p_categories).toEqual([
      "Sayur & Buah",
      "Daging & Ikan",
      "Makanan Siap Saji",
      "Kerajinan",
      "Jasa",
    ]);
  });
});
