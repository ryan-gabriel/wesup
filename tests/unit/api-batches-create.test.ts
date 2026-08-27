import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as createBatch } from "@/app/api/batches/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

const SUPPLIER_ID = "33333333-3333-4333-8333-333333333333";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";

const VALID_TIMELINE = {
  registration_opens_at: "2030-01-01T00:00:00Z",
  registration_closes_at: "2030-01-02T00:00:00Z",
  payment_opens_at: "2030-01-02T01:00:00Z",
  payment_closes_at: "2030-01-03T00:00:00Z",
  estimated_ready_at: "2030-01-05T00:00:00Z",
};

function postJson(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/batches", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function mockVerifiedSupplierClient() {
  const timelineInsert = vi.fn(async () => ({ data: null, error: null }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { role: "supplier", status: "active", full_name: "S" },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "supplier_profiles") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { verification_status: "approved" }, error: null }),
          }),
        }),
      };
    }
    if (table === "batches") {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: BATCH_ID }, error: null }),
          }),
        }),
        delete: () => ({ eq: async () => ({ data: null, error: null }) }),
      };
    }
    if (table === "batch_timeline") return { insert: timelineInsert };
    return { insert: async () => ({ data: null, error: null }) };
  });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: SUPPLIER_ID } }, error: null }) },
    from,
  };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { from, timelineInsert };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Cabai Merah Keriting",
    category: "sayur",
    min_quantity: 50,
    pickup_address: "Jl. Test No. 1, Bandung",
    latitude: -6.9,
    longitude: 107.6,
    tiers: [{ min_volume: 1, max_volume: null, price_per_unit: 40000 }],
    timeline: VALID_TIMELINE,
    ...overrides,
  };
}

describe("POST /api/batches — absolute timeline validation", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("creates the batch and persists a normalized linear timeline", async () => {
    const { timelineInsert } = mockVerifiedSupplierClient();
    const res = await createBatch(postJson(validPayload()));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ data: { id: BATCH_ID } });
    expect(timelineInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        batch_id: BATCH_ID,
        registration_opens_at: "2030-01-01T00:00:00.000Z",
        estimated_ready_at: "2030-01-05T00:00:00.000Z",
      }),
    );
  });

  it("returns 400 when timeline is missing", async () => {
    mockVerifiedSupplierClient();
    const payload = validPayload() as Record<string, unknown>;
    // biome-ignore lint: intentional key removal in test fixture
    delete payload.timeline;
    const res = await createBatch(postJson(payload));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Timeline is required" });
  });

  it("returns 400 when a timestamp is not an absolute date", async () => {
    mockVerifiedSupplierClient();
    const res = await createBatch(
      postJson(validPayload({ timeline: { ...VALID_TIMELINE, payment_opens_at: "besok" } })),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("payment_opens_at");
  });

  it("returns 400 when close precedes open (Buka < Tutup violated)", async () => {
    mockVerifiedSupplierClient();
    const res = await createBatch(
      postJson(
        validPayload({
          timeline: { ...VALID_TIMELINE, registration_closes_at: "2029-12-31T00:00:00Z" },
        }),
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("registration_opens_at");
  });

  it("returns 400 when payment window starts before registration closes", async () => {
    mockVerifiedSupplierClient();
    const res = await createBatch(
      postJson(
        validPayload({
          timeline: { ...VALID_TIMELINE, payment_opens_at: "2030-01-01T12:00:00Z" },
        }),
      ),
    );
    expect(res.status).toBe(400);
  });
});
