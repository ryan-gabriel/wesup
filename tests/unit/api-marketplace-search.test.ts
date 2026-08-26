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
}

function mockSearchClient(options: {
  rows?: SearchRow[];
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
  const rpc = vi.fn(async () => ({
    data: (options.rows ?? []) as unknown[],
    error: null,
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
    expect(json).toEqual({
      items: [{ id: "b1", title: "Cabai" }],
      total: 1,
      page: 1,
      limit: 12,
    });
    expect(rpc).toHaveBeenCalledWith("search_batches", {
      p_query: null,
      p_categories: null,
      p_lat: BANDUNG.latitude,
      p_lng: BANDUNG.longitude,
      p_radius_km: 10,
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
    await expect(res.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 3,
      limit: 12,
    });
    expect(rpc).toHaveBeenCalledWith("search_batches", {
      p_query: "cabai",
      p_categories: ["Sayur & Buah", "Kerajinan"],
      p_lat: -6.9,
      p_lng: 107.6,
      p_radius_km: 25,
      p_limit: 12,
      p_offset: 24,
    });
  });

  it("clamps radius into the 1..50 km range", async () => {
    const { rpc } = mockSearchClient({ rows: [], user: null });
    await searchBatches(getReq("?radius=999"));
    expect(rpc.mock.calls[0][1].p_radius_km).toBe(50);
    await searchBatches(getReq("?radius=0"));
    expect(rpc.mock.calls[1][1].p_radius_km).toBe(1);
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
    expect(rpc.mock.calls[0][1].p_lat).toBe(-6.95);
    expect(rpc.mock.calls[0][1].p_lng).toBe(107.7);
  });

  it("uses bandung center when the stored profile has no coordinates", async () => {
    const { rpc } = mockSearchClient({
      rows: [],
      user: { id: UMKM_ID },
      role: "umkm",
      profileCoords: null,
    });
    await searchBatches(getReq(""));
    expect(rpc.mock.calls[0][1].p_lat).toBe(BANDUNG.latitude);
    expect(rpc.mock.calls[0][1].p_lng).toBe(BANDUNG.longitude);
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
    const { rpc } = mockSearchClient({ rows: [] });
    rpc.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const res = await searchBatches(getReq(""));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("accepts every allow-listed category", async () => {
    const { rpc } = mockSearchClient({ rows: [], user: null });
    const res = await searchBatches(
      getReq(
        "?categories=Sayur%20%26%20Buah,Daging%20%26%20Ikan,Makanan%20Siap%20Saji,Kerajinan,Jasa",
      ),
    );
    expect(res.status).toBe(200);
    expect(rpc.mock.calls[0][1].p_categories).toEqual([
      "Sayur & Buah",
      "Daging & Ikan",
      "Makanan Siap Saji",
      "Kerajinan",
      "Jasa",
    ]);
  });
});
