import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getProgress } from "@/app/api/batches/[id]/progress/route";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(),
}));

const { getMock, setMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: { get: getMock, set: setMock },
}));

const mockGetServerClient = vi.mocked(getServerClient);
const mockGetAdminClient = vi.mocked(getAdminClient);

const BATCH_ID = "44444444-4444-4444-8444-444444444444";

const TIERS = [
  { tier_number: 2, min_volume: 50, max_volume: 99, price_per_unit: 9000 },
  { tier_number: 1, min_volume: 1, max_volume: 49, price_per_unit: 10000 },
];

const TIMELINE = {
  registration_closes_at: "2026-09-02T00:00:00.000Z",
};

interface BuildOptions {
  batchStatus?: string;
  batchMissing?: boolean;
  timeline?: typeof TIMELINE | null;
  tiers?: typeof TIERS | null;
  registrationRows?: Array<{ quantity: number; status: string }>;
  registrationError?: Error | null;
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function buildClients(options: BuildOptions = {}) {
  const batchSingle = vi.fn(async () =>
    options.batchMissing
      ? { data: null, error: null }
      : { data: { status: options.batchStatus ?? "published" }, error: null },
  );
  const timelineSingle = vi.fn(async () =>
    options.timeline === null
      ? { data: null, error: null }
      : { data: options.timeline ?? TIMELINE, error: null },
  );
  const tiersSelect = vi.fn(async () =>
    options.tiers === null
      ? { data: null, error: null }
      : { data: options.tiers ?? TIERS, error: null },
  );

  const from = vi.fn((table: string) => {
    if (table === "batches") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: batchSingle })) })) };
    }
    if (table === "batch_timeline") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: timelineSingle })) })) };
    }
    if (table === "batch_tiers") {
      return { select: vi.fn(() => ({ eq: tiersSelect })) };
    }
    throw new Error(`unexpected table ${table}`);
  });
  const client = { from };
  mockGetServerClient.mockResolvedValue(client as never);

  const registrationQuery = vi.fn(async () => ({
    data: options.registrationRows ?? [],
    error: options.registrationError ?? null,
  }));
  const adminFrom = vi.fn((table: string) => {
    if (table !== "registrations") throw new Error(`unexpected table ${table}`);
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: registrationQuery,
        })),
      })),
    };
  });
  mockGetAdminClient.mockReturnValue({ from: adminFrom } as never);

  return { from, adminFrom, registrationQuery };
}

describe("GET /api/batches/[id]/progress", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    mockGetAdminClient.mockReset();
    getMock.mockReset();
    setMock.mockReset();
  });

  it("rejects an invalid batch id before accessing Supabase or Redis", async () => {
    const res = await getProgress(new Request("http://localhost"), routeParams("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(mockGetServerClient).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing batch", async () => {
    buildClients({ batchMissing: true });
    const res = await getProgress(new Request("http://localhost"), routeParams(BATCH_ID));
    expect(res.status).toBe(404);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("does not expose progress for an unpublished batch", async () => {
    buildClients({ batchStatus: "draft" });
    const res = await getProgress(new Request("http://localhost"), routeParams(BATCH_ID));
    expect(res.status).toBe(404);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("fails closed when Redis is unavailable", async () => {
    buildClients();
    getMock.mockRejectedValue(new Error("redis down"));
    const res = await getProgress(new Request("http://localhost"), routeParams(BATCH_ID));
    expect(res.status).toBe(503);
  });

  it("returns the live counter, sorted tiers, tier progress, and server time", async () => {
    buildClients();
    getMock.mockResolvedValue(17);

    const res = await getProgress(new Request("http://localhost"), routeParams(BATCH_ID));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.batchId).toBe(BATCH_ID);
    expect(body.status).toBe("published");
    expect(body.registeredQuantity).toBe(17);
    expect(body.registrationClosesAt).toBe(TIMELINE.registration_closes_at);
    expect(body.tiers.map((tier: { tierNumber: number }) => tier.tierNumber)).toEqual([1, 2]);
    expect(body.tierProgress).toEqual({
      currentTierNumber: 1,
      currentPricePerUnit: 10000,
      nextTierNumber: 2,
      nextTierMinVolume: 50,
      remainingToNextTier: 33,
      progressPercent: 34,
    });
    expect(Number.isNaN(Date.parse(body.serverTime))).toBe(false);
    expect(mockGetAdminClient).not.toHaveBeenCalled();
  });

  it("hydrates a missing Redis counter from registered and pending-payment rows", async () => {
    buildClients({
      registrationRows: [
        { quantity: 5, status: "registered" },
        { quantity: 7, status: "pending_payment" },
      ],
    });
    getMock.mockResolvedValue(null);
    setMock.mockResolvedValue("OK");

    const res = await getProgress(new Request("http://localhost"), routeParams(BATCH_ID));
    expect(res.status).toBe(200);
    expect((await res.json()).registeredQuantity).toBe(12);
    expect(setMock).toHaveBeenCalledWith(`batch:${BATCH_ID}:count`, 12);
  });

  it("returns 503 when the authoritative fallback query fails", async () => {
    buildClients({ registrationError: new Error("db down") });
    getMock.mockResolvedValue(null);

    const res = await getProgress(new Request("http://localhost"), routeParams(BATCH_ID));
    expect(res.status).toBe(503);
  });
});
