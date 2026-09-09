import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as cutOff } from "@/app/api/batches/[id]/cutoff/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const { setMock, evalMock, delMock } = vi.hoisted(() => ({
  setMock: vi.fn(),
  evalMock: vi.fn(),
  delMock: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  redis: { set: setMock, eval: evalMock, del: delMock },
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

const SUPPLIER_ID = "33333333-3333-4333-8333-333333333333";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";

function postJson(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers,
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockClient(role: "supplier" | "admin" = "supplier") {
  const getUser = vi.fn(async () => ({
    data: { user: { id: SUPPLIER_ID, email: "x@example.com" }, error: null },
  }));
  const single = vi.fn(async () => ({
    data: { role, status: "active", full_name: "Owner" },
    error: null,
  }));
  const rpc = vi.fn(
    async () => ({ data: null, error: null }) as {
      data: null;
      error: { message: string } | null;
    },
  );
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single })),
        })),
      };
    }
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) })) };
  });
  const client = { auth: { getUser }, from, rpc };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { rpc };
}

describe("POST /api/batches/[id]/cutoff (distributed lock gatekeeper)", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    mockEnforceRateLimit.mockReset();
    mockEnforceRateLimit.mockResolvedValue(null as never);
    setMock.mockReset();
    evalMock.mockReset();
    delMock.mockReset();
  });

  it("acquires the SETNX lock, runs cut_off_batch, and releases the lock", async () => {
    const { rpc } = mockClient("supplier");
    setMock.mockResolvedValue("OK");
    evalMock.mockResolvedValue(1);

    const res = await cutOff(
      postJson(`/api/batches/${BATCH_ID}/cutoff`) as unknown as Request,
      routeParams(BATCH_ID) as never,
    );
    expect(res.status).toBe(200);

    const lockKey = `cutoff-lock:${BATCH_ID}`;
    expect(setMock).toHaveBeenCalledWith(
      lockKey,
      expect.any(String),
      expect.objectContaining({ nx: true }),
    );
    expect(rpc).toHaveBeenCalledWith("cut_off_batch", {
      p_batch_id: BATCH_ID,
      p_ip_address: null,
      p_user_agent: null,
    });
    expect(evalMock).toHaveBeenCalled(); // release uses compare-and-del
    expect(delMock).toHaveBeenCalledWith(`batch:${BATCH_ID}:count`);
  });

  it("returns 409 and does NOT run the RPC when another worker holds the lock", async () => {
    const { rpc } = mockClient("supplier");
    setMock.mockResolvedValue(null);

    const res = await cutOff(
      postJson(`/api/batches/${BATCH_ID}/cutoff`) as unknown as Request,
      routeParams(BATCH_ID) as never,
    );
    expect(res.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
    expect(evalMock).not.toHaveBeenCalled();
  });

  it("returns 409 without touching Redis when the batch is invalid", async () => {
    mockClient("supplier");
    const res = await cutOff(
      postJson(`/api/batches/not-a-uuid/cutoff`) as unknown as Request,
      routeParams("not-a-uuid") as never,
    );
    expect(res.status).toBe(400);
    expect(setMock).not.toHaveBeenCalled();
  });

  it("propagates a 409 when the RPC reports the batch is already closed", async () => {
    mockClient("supplier");
    setMock.mockResolvedValue("OK");
    evalMock.mockResolvedValue(1);
    mockGetServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: SUPPLIER_ID, email: "x@example.com" }, error: null },
        })),
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { role: "supplier", status: "active", full_name: "Owner" },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      }),
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: "batch not found or already closed" },
      })),
    } as unknown as SupabaseClient<Database>);

    const res = await cutOff(
      postJson(`/api/batches/${BATCH_ID}/cutoff`) as unknown as Request,
      routeParams(BATCH_ID) as never,
    );
    expect(res.status).toBe(409);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the RPC fails for an unknown reason", async () => {
    mockClient("supplier");
    setMock.mockResolvedValue("OK");
    evalMock.mockResolvedValue(1);
    mockGetServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: SUPPLIER_ID, email: "x@example.com" }, error: null },
        })),
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { role: "supplier", status: "active", full_name: "Owner" },
                  error: null,
                })),
              })),
            })),
          };
        }
        return {};
      }),
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: "unexpected failure" },
      })),
    } as unknown as SupabaseClient<Database>);

    const res = await cutOff(
      postJson(`/api/batches/${BATCH_ID}/cutoff`) as unknown as Request,
      routeParams(BATCH_ID) as never,
    );
    expect(res.status).toBe(500);
  });
});
