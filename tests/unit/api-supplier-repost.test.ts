import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as repostBatch } from "@/app/api/suppliers/batches/[id]/repost/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

const SUPPLIER_ID = "33333333-3333-4333-8333-333333333333";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";
const NEW_ID = "55555555-5555-4555-8555-555555555555";

const SRC_TIMELINE = {
  registration_opens_at: "2030-03-04T02:00:00.000Z",
  registration_closes_at: "2030-03-05T02:00:00.000Z",
  payment_opens_at: "2030-03-05T03:00:00.000Z",
  payment_closes_at: "2030-03-06T02:00:00.000Z",
  estimated_ready_at: "2030-03-09T02:00:00.000Z",
};

const SOURCE_ROW = {
  id: BATCH_ID,
  supplier_id: SUPPLIER_ID,
  title: "Cabai Merah",
  description: "Level 1",
  category: "sayur",
  min_quantity: 50,
  pickup_address: "Jl. Test No. 1",
  latitude: -6.9,
  longitude: 107.6,
  status: "published",
  recurring_config_id: null,
  batch_tiers: [
    { tier_number: 1, min_volume: 1, max_volume: null, price_per_unit: 40000 },
    { tier_number: 2, min_volume: 100, max_volume: 200, price_per_unit: 35000 },
  ],
  batch_timeline: SRC_TIMELINE,
};

const DAY = 86_400_000;

function postJson(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/suppliers/batches/${BATCH_ID}/repost`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

interface MockOptions {
  profile?: { role: string; status: string; full_name: string } | null;
  source?: Record<string, unknown> | null;
  timelineInsertError?: { message: string } | null;
}

function mockSupplierClient(options: MockOptions = {}) {
  const timelineInsert = vi.fn(async () => ({
    data: null,
    error: options.timelineInsertError ?? null,
  }));
  const singleSource = vi.fn(async () => ({
    data: options.source === undefined ? SOURCE_ROW : options.source,
    error: null,
  }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data:
                options.profile === undefined
                  ? { role: "supplier", status: "active", full_name: "S" }
                  : options.profile,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "batches") {
      return {
        select: () => ({ eq: () => ({ eq: () => ({ single: singleSource }) }) }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: NEW_ID }, error: null }),
          }),
        }),
        delete: () => ({ eq: async () => ({ data: null, error: null }) }),
      };
    }
    if (table === "batch_timeline") return { insert: timelineInsert };
    return {
      insert: async () => ({ data: null, error: null }),
      delete: () => ({ eq: async () => ({ data: null, error: null }) }),
    };
  });
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: SUPPLIER_ID } }, error: null }),
    },
    from,
  };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { timelineInsert };
}

describe("POST /api/suppliers/batches/[id]/repost", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("creates a draft copy with every timestamp shifted by interval_days", async () => {
    const { timelineInsert } = mockSupplierClient();
    const res = await repostBatch(postJson({ interval_days: 7 }), routeParams(BATCH_ID));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ data: { id: NEW_ID } });

    for (const [field, value] of Object.entries(SRC_TIMELINE)) {
      expect(timelineInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          batch_id: NEW_ID,
          [field]: new Date(Date.parse(value) + 7 * DAY).toISOString(),
        }),
      );
    }
  });

  it("returns 400 when interval_days is missing or not a positive integer", async () => {
    mockSupplierClient();
    for (const bad of [{}, { interval_days: 0 }, { interval_days: -7 }, { interval_days: 1.5 }, { interval_days: "7" }]) {
      const res = await repostBatch(postJson(bad), routeParams(BATCH_ID));
      expect(res.status).toBe(400);
    }
  });

  it("returns 404 when the source batch does not exist or is not owned", async () => {
    mockSupplierClient({ source: null });
    const res = await repostBatch(postJson({ interval_days: 7 }), routeParams(BATCH_ID));
    expect(res.status).toBe(404);
  });

  it("returns 403 for a non-supplier role", async () => {
    mockSupplierClient({
      profile: { role: "umkm", status: "active", full_name: "B" },
    });
    const res = await repostBatch(postJson({ interval_days: 7 }), routeParams(BATCH_ID));
    expect(res.status).toBe(403);
  });

  it("returns 500 and cleans up when the timeline insert fails", async () => {
    mockSupplierClient({ timelineInsertError: { message: "boom" } });
    const res = await repostBatch(postJson({ interval_days: 7 }), routeParams(BATCH_ID));
    expect(res.status).toBe(500);
  });
});
