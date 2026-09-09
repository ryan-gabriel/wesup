import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as cutoff } from "@/app/api/batches/[id]/cutoff/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

vi.mock("@/lib/batches/cutoff-runner", () => ({
  runBatchCutoff: vi.fn(),
}));

import { runBatchCutoff } from "@/lib/batches/cutoff-runner";

const mockGetServerClient = vi.mocked(getServerClient);
const mockRun = vi.mocked(runBatchCutoff);

const BATCH_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";

function post(): NextRequest {
  return new NextRequest(`http://localhost/api/batches/${BATCH_ID}/cutoff`, {
    method: "POST",
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockActiveUser() {
  const getUser = vi.fn(async () => ({
    data: { user: { id: USER_ID } },
    error: null,
  }));
  const single = vi.fn(async () => ({
    data: { role: "umkm", status: "active", full_name: "U" },
    error: null,
  }));
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ single }) }) }));
  mockGetServerClient.mockResolvedValue({ auth: { getUser }, from } as unknown as SupabaseClient<Database>);
}

describe("POST /api/batches/[id]/cutoff (J2 — hybrid trigger)", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    mockRun.mockReset();
  });

  it("returns 400 for an invalid batch id without touching auth", async () => {
    const res = await cutoff(post(), routeParams("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(mockGetServerClient).not.toHaveBeenCalled();
  });

  it("returns 401 when not signed in", async () => {
    mockGetServerClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
    } as unknown as SupabaseClient<Database>);
    const res = await cutoff(post(), routeParams(BATCH_ID));
    expect(res.status).toBe(401);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("locks Tier 2 and returns the server timestamp (anti time-travel)", async () => {
    mockActiveUser();
    mockRun.mockResolvedValue({
      applied: true,
      totalVolume: 60,
      tier: { tier_number: 2, min_volume: 50, max_volume: 99, price_per_unit: 8000 },
      affected: 3,
    });
    const res = await cutoff(post(), routeParams(BATCH_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.locked_tier).toBe(2);
    expect(body.data.total_volume).toBe(60);
    expect(body.data.affected).toBe(3);
    expect(typeof body.meta.timestamp).toBe("string");
    expect(mockRun).toHaveBeenCalledWith(expect.anything(), BATCH_ID, expect.any(Number));
  });

  it("is idempotent: already-locked batch returns locked:false", async () => {
    mockActiveUser();
    mockRun.mockResolvedValue({ applied: false, reason: "already_locked" });
    const res = await cutoff(post(), routeParams(BATCH_ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: { locked: false, reason: "already_locked" },
    });
  });

  it("returns 202 when another request holds the cutoff lock", async () => {
    mockActiveUser();
    mockRun.mockResolvedValue({ applied: false, reason: "lock_busy" });
    const res = await cutoff(post(), routeParams(BATCH_ID));
    expect(res.status).toBe(202);
  });
});
