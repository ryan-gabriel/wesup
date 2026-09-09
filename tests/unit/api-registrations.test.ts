import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as register } from "@/app/api/registrations/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const { incrbyMock, evalMock } = vi.hoisted(() => ({
  incrbyMock: vi.fn(),
  evalMock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: { incrby: incrbyMock, eval: evalMock },
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit",
  );
  return {
    ...actual,
    enforceRateLimit: vi.fn(async () => null),
  };
});

import { enforceRateLimit } from "@/lib/rate-limit";

const mockGetServerClient = vi.mocked(getServerClient);
const mockEnforceRateLimit = vi.mocked(enforceRateLimit);

const UMKM_ID = "11111111-1111-4111-8111-111111111111";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";

const TIMELINE = {
  registration_opens_at: "2026-09-01T00:00:00.000Z",
  registration_closes_at: "2026-09-02T00:00:00.000Z",
  payment_opens_at: "2026-09-02T01:00:00.000Z",
  payment_closes_at: "2026-09-03T00:00:00.000Z",
  estimated_ready_at: "2026-09-04T00:00:00.000Z",
};

interface TierLike {
  tier_number: number;
  min_volume: number;
  max_volume: number | null;
  price_per_unit: number;
}

const TIERS: TierLike[] = [
  { tier_number: 1, min_volume: 1, max_volume: 49, price_per_unit: 10000 },
  { tier_number: 2, min_volume: 50, max_volume: 99, price_per_unit: 9000 },
];

function postJson(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/registrations", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
  });
}

interface ClientOpts {
  batchStatus?: string;
  timeline?: typeof TIMELINE | null;
  tiers?: TierLike[] | null;
  tiersOverride?: TierLike[];
  insertError?: { code?: string; message?: string } | null;
}

function buildClient(opts: ClientOpts) {
  const batchStatus = opts.batchStatus ?? "published";
  const timeline =
    "timeline" in opts && opts.timeline === null ? null : TIMELINE;
  const hasTiersOverride = "tiersOverride" in opts && opts.tiersOverride !== undefined;
  const tiers = hasTiersOverride
    ? opts.tiersOverride
    : "tiers" in opts && opts.tiers === null
      ? null
      : TIERS;

  const getUser = vi.fn(async () => ({
    data: { user: { id: UMKM_ID, email: "umkm@example.com" }, error: null },
  }));

  const batchSingle = vi.fn(async () => {
    if (opts.batchStatus === "missing") return { data: null, error: null };
    return { data: { id: BATCH_ID, status: batchStatus }, error: null };
  });

  const timelineSingle = vi.fn(async () =>
    timeline ? { data: timeline, error: null } : { data: null, error: null },
  );

  const tiersSelect = vi.fn(async () =>
    tiers ? { data: tiers, error: null } : { data: null, error: null },
  );

  const upsert = vi.fn(async () => ({ error: null }));
  const insertSingle = vi.fn(async () => ({
    data: { id: "reg-1" },
    error: opts.insertError ?? null,
  }));
  const selectInserted = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn(() => ({ select: selectInserted }));

  const rpc = vi.fn(async () => ({ data: null, error: null }));

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { role: "umkm", status: "active", full_name: "UMKM" }, error: null })) })),
        })),
      };
    }
    if (table === "batches") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: batchSingle })) })) };
    }
    if (table === "batch_timeline") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: timelineSingle })) })) };
    }
    if (table === "batch_tiers") {
      return { select: vi.fn(() => ({ eq: tiersSelect })) };
    }
    if (table === "registration_counters") {
      return { upsert };
    }
    if (table === "registrations") {
      return { insert };
    }
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) })) };
  });

  const client = { auth: { getUser }, from, rpc };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, batchSingle, upsert, insert, insertSingle };
}

const validBody = {
  batchId: BATCH_ID,
  quantity: 5,
  consentLat: -6.9175,
  consentLng: 107.6191,
};

describe("POST /api/registrations (atomic register)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-09-01T12:00:00.000Z"));
    mockGetServerClient.mockReset();
    mockEnforceRateLimit.mockReset();
    mockEnforceRateLimit.mockResolvedValue(null as never);
    incrbyMock.mockReset();
    evalMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("atomically increments the Redis counter and records the registration within the window", async () => {
    const { upsert, insert } = buildClient({});
    incrbyMock.mockResolvedValue(17);

    const res = await register(postJson(validBody) as unknown as Request);
    expect(res.status).toBe(201);
    expect(incrbyMock).toHaveBeenCalledWith(`batch:${BATCH_ID}:count`, 5);
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
    expect(incrbyMock).toHaveBeenCalledTimes(1);
  });

  it("rejects when called before registration opens", async () => {
    buildClient({});
    vi.setSystemTime(Date.parse("2026-08-31T23:00:00.000Z"));
    const res = await register(postJson(validBody) as unknown as Request);
    expect(res.status).toBe(403);
    expect(incrbyMock).not.toHaveBeenCalled();
  });

  it.each([
    ["at cutoff", "2026-09-02T00:00:00.000Z"],
    ["after cutoff", "2026-09-02T00:00:01.000Z"],
  ])("rejects %s (capacity locked)", async (_label, nowIso) => {
    vi.setSystemTime(Date.parse(nowIso));
    buildClient({});
    const res = await register(postJson(validBody) as unknown as Request);
    expect(res.status).toBe(403);
    expect(incrbyMock).not.toHaveBeenCalled();
  });

  it("rejects a batch that is not published", async () => {
    buildClient({ batchStatus: "draft" });
    const res = await register(postJson(validBody) as unknown as Request);
    expect(res.status).toBe(403);
    expect(incrbyMock).not.toHaveBeenCalled();
  });

  it("rejects when the batch does not exist", async () => {
    buildClient({ batchStatus: "missing" });
    const res = await register(postJson(validBody) as unknown as Request);
    expect(res.status).toBe(404);
  });

  it("rejects quantity above the tier maximum", async () => {
    buildClient({});
    const res = await register(
      postJson({ ...validBody, quantity: 9999 }) as unknown as Request,
    );
    expect(res.status).toBe(400);
    expect(incrbyMock).not.toHaveBeenCalled();
  });

  it("rejects a non-safe-integer quantity before touching Redis", async () => {
    buildClient({
      tiersOverride: [
        { tier_number: 1, min_volume: 1, max_volume: null, price_per_unit: 10000 },
      ],
    });
    const res = await register(
      postJson({ ...validBody, quantity: 9_007_199_254_740_993 }) as unknown as Request,
    );
    expect(res.status).toBe(400);
    expect(incrbyMock).not.toHaveBeenCalled();
  });

  it("rejects invalid input", async () => {
    buildClient({});
    const res = await register(postJson({}) as unknown as Request);
    expect(res.status).toBe(400);
  });

  it("returns 503 (fail closed) when Redis is unavailable", async () => {
    buildClient({});
    incrbyMock.mockRejectedValue(new Error("redis down"));
    const res = await register(postJson(validBody) as unknown as Request);
    expect(res.status).toBe(503);
    expect(evalMock).not.toHaveBeenCalled();
  });

  it("decrements the Redis counter when the insert fails with a duplicate code 23505 (rolls back the INCR)", async () => {
    buildClient({ insertError: { code: "23505", message: "duplicate key value violates unique constraint" } });
    incrbyMock.mockResolvedValue(9);

    const res = await register(postJson(validBody) as unknown as Request);
    expect(res.status).toBe(409);
    expect(incrbyMock).toHaveBeenNthCalledWith(2, `batch:${BATCH_ID}:count`, -5);
  });

  it("decrements the Redis counter when the insert fails with a duplicate message and no code (legacy fallback)", async () => {
    buildClient({ insertError: { message: "duplicate key value violates unique constraint" } });
    incrbyMock.mockResolvedValue(9);

    const res = await register(postJson(validBody) as unknown as Request);
    expect(res.status).toBe(409);
    expect(incrbyMock).toHaveBeenNthCalledWith(2, `batch:${BATCH_ID}:count`, -5);
  });

  it("decrements the Redis counter when the insert fails for an unknown reason", async () => {
    buildClient({ insertError: { message: "db down" } });
    incrbyMock.mockResolvedValue(9);

    const res = await register(postJson(validBody) as unknown as Request);
    expect(res.status).toBe(500);
    expect(incrbyMock).toHaveBeenNthCalledWith(2, `batch:${BATCH_ID}:count`, -5);
  });

  it("returns 429 when the UMKM is rate limited", async () => {
    buildClient({});
    mockEnforceRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: "rate" }), { status: 429 }) as never,
    );
    const res = await register(postJson(validBody) as unknown as Request);
    expect(res.status).toBe(429);
  });
});
