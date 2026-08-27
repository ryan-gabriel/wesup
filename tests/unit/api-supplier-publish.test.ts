import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as publishBatch } from "@/app/api/suppliers/batches/[id]/publish/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

const SUPPLIER_ID = "33333333-3333-4333-8333-333333333333";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";

function post(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: "POST" });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockSupplierClient(options: {
  user?: { id: string } | null;
  profile?: { role: string; status: string; full_name: string } | null;
  rpcError?: { message: string } | null;
}) {
  const getUser = vi.fn(async () => ({
    data: {
      user: options.user === undefined ? { id: SUPPLIER_ID } : options.user,
    },
    error: null,
  }));
  const single = vi.fn(async () =>
    options.profile === undefined
      ? {
          data: { role: "supplier", status: "active", full_name: "S" },
          error: null,
        }
      : { data: options.profile ?? null, error: null },
  );
  const rpc = vi.fn(async () => ({
    data: null,
    error: options.rpcError ?? null,
  }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return { select: () => ({ eq: () => ({ single }) }) };
    }
    return {};
  });
  const client = { auth: { getUser }, from, rpc };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { rpc };
}

describe("POST /api/suppliers/batches/[id]/publish", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 and calls publish_batch rpc", async () => {
    const { rpc } = mockSupplierClient({});
    const res = await publishBatch(post("/api/suppliers/batches/x/publish"), routeParams(BATCH_ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("publish_batch", { p_batch_id: BATCH_ID });
  });

  it("returns 400 for an invalid batch id", async () => {
    mockSupplierClient({});
    const res = await publishBatch(post("/x"), routeParams("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    mockSupplierClient({ user: null, profile: null });
    const res = await publishBatch(post("/x"), routeParams(BATCH_ID));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-supplier role", async () => {
    mockSupplierClient({
      profile: { role: "umkm", status: "active", full_name: "B" },
    });
    const res = await publishBatch(post("/x"), routeParams(BATCH_ID));
    expect(res.status).toBe(403);
  });

  it("returns 403 for a suspended supplier", async () => {
    mockSupplierClient({
      profile: { role: "supplier", status: "suspended_temporary", full_name: "S" },
    });
    const res = await publishBatch(post("/x"), routeParams(BATCH_ID));
    expect(res.status).toBe(403);
  });

  it("returns 500 when the rpc fails", async () => {
    mockSupplierClient({ rpcError: { message: "boom" } });
    const res = await publishBatch(post("/x"), routeParams(BATCH_ID));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
