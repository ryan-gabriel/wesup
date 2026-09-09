import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as reconcile } from "@/app/api/batches/[id]/reconcile/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit",
  );
  return { ...actual, enforceRateLimit: vi.fn(async () => null) };
});

const { acquireMock, releaseMock } = vi.hoisted(() => ({
  acquireMock: vi.fn(),
  releaseMock: vi.fn(),
}));

vi.mock("@/app/api/_lib/distributed-lock", () => ({
  acquireLock: acquireMock,
  releaseLock: releaseMock,
}));

import { enforceRateLimit } from "@/lib/rate-limit";

const mockGetServerClient = vi.mocked(getServerClient);

const SUPPLIER_ID = "33333333-3333-4333-8333-333333333333";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";

function post(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: "POST" });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockClient(options: {
  role?: string;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
}) {
  const getUser = vi.fn(async () => ({
    data: { user: { id: SUPPLIER_ID, email: "s@example.com" } },
    error: null,
  }));
  const single = vi.fn(async () => ({
    data: { role: options.role ?? "supplier", status: "active", full_name: "S" },
    error: null,
  }));
  const rpc = vi.fn(async () => ({
    data: options.rpcData ?? { struck: 2, warned: 1, suspended_temporary: 1, suspended_permanent: 0 },
    error: options.rpcError ?? null,
  }));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })),
  }));
  mockGetServerClient.mockResolvedValue({ auth: { getUser }, from, rpc } as unknown as SupabaseClient<Database>);
  return { rpc };
}

describe("POST /api/batches/[id]/reconcile (Hit & Run gatekeeper)", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    vi.mocked(enforceRateLimit).mockReset();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
    acquireMock.mockReset();
    releaseMock.mockReset();
    acquireMock.mockResolvedValue("tok");
    releaseMock.mockResolvedValue(true);
  });

  it("returns 400 for an invalid batch id without touching the lock", async () => {
    const res = await reconcile(post("/x"), routeParams("not-a-uuid"));
    expect(res.status).toBe(400);
    expect(acquireMock).not.toHaveBeenCalled();
  });

  it("locks, runs apply_hit_and_run, releases, and returns the summary", async () => {
    const { rpc } = mockClient({});
    const res = await reconcile(post(`/api/batches/${BATCH_ID}/reconcile`), routeParams(BATCH_ID));
    expect(res.status).toBe(200);
    expect(acquireMock).toHaveBeenCalledWith(`reconcile:${BATCH_ID}`, 60);
    expect(rpc).toHaveBeenCalledWith("apply_hit_and_run", {
      p_batch_id: BATCH_ID,
      p_ip_address: null,
      p_user_agent: null,
    });
    expect(releaseMock).toHaveBeenCalledWith(`reconcile:${BATCH_ID}`, "tok");
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: { struck: 2 },
    });
  });

  it("returns 409 without running the RPC when the lock is held", async () => {
    acquireMock.mockResolvedValue(null);
    const { rpc } = mockClient({});
    const res = await reconcile(post(`/api/batches/${BATCH_ID}/reconcile`), routeParams(BATCH_ID));
    expect(res.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
    expect(releaseMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the payment window is still open", async () => {
    mockClient({ rpcError: { message: "payment window still open" } });
    const res = await reconcile(post(`/api/batches/${BATCH_ID}/reconcile`), routeParams(BATCH_ID));
    expect(res.status).toBe(409);
    expect(releaseMock).toHaveBeenCalled();
  });

  it("returns 404 for an unknown batch and 500 for unknown failures", async () => {
    mockClient({ rpcError: { message: "batch not found" } });
    expect(
      (await reconcile(post(`/api/batches/${BATCH_ID}/reconcile`), routeParams(BATCH_ID))).status,
    ).toBe(404);

    mockClient({ rpcError: { message: "unexpected failure" } });
    expect(
      (await reconcile(post(`/api/batches/${BATCH_ID}/reconcile`), routeParams(BATCH_ID))).status,
    ).toBe(500);
  });

  it("forbids non supplier/admin callers", async () => {
    mockClient({ role: "umkm" });
    const res = await reconcile(post(`/api/batches/${BATCH_ID}/reconcile`), routeParams(BATCH_ID));
    expect(res.status).toBe(403);
  });
});
