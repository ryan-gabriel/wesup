import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as cancelBatch } from "@/app/api/suppliers/batches/[id]/cancel/route";
import { getServerClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

const SUPPLIER_ID = "33333333-3333-4333-8333-333333333333";
const BATCH_ID = "44444444-4444-4444-8444-444444444444";

function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

interface SessionOptions {
  user?: { id: string; email?: string } | null;
  profile?: { role: string; status: string; full_name: string } | null;
}

function mockSupplierClient(options: SessionOptions) {
  const getUser = vi.fn(async () =>
    options.user === undefined
      ? {
          data: {
            user: { id: SUPPLIER_ID, email: "supplier@example.com" },
            error: null,
          },
        }
      : { data: { user: options.user }, error: null },
  );
  const single = vi.fn(async () =>
    options.profile === undefined
      ? {
          data: { role: "supplier", status: "active", full_name: "Supplier" },
          error: null,
        }
      : { data: options.profile ?? null, error: null },
  );
  const rpc = vi.fn(
    async () =>
      ({ data: null, error: null }) as {
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
  return { client, rpc };
}

describe("POST /api/suppliers/batches/[id]/cancel", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 and calls cancel_batch with reason and request metadata", async () => {
    const { rpc } = mockSupplierClient({});
    const req = postJson(
      `/api/suppliers/batches/x/cancel`,
      { reason: "Gagal panen" },
      { "x-forwarded-for": "1.2.3.4", "user-agent": "test-agent" },
    );
    const res = await cancelBatch(req, routeParams(BATCH_ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("cancel_batch", {
      p_batch_id: BATCH_ID,
      p_reason: "Gagal panen",
      p_ip_address: "1.2.3.4",
      p_user_agent: "test-agent",
    });
  });

  it("returns 400 for an invalid batch id", async () => {
    mockSupplierClient({});
    const res = await cancelBatch(
      postJson("/api/suppliers/batches/x/cancel", { reason: "x" }),
      routeParams("not-a-uuid"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when reason is missing", async () => {
    mockSupplierClient({});
    const res = await cancelBatch(
      postJson("/api/suppliers/batches/x/cancel", {}),
      routeParams(BATCH_ID),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Cancellation reason is required",
    });
  });

  it("returns 400 when reason is whitespace only", async () => {
    mockSupplierClient({});
    const res = await cancelBatch(
      postJson("/api/suppliers/batches/x/cancel", { reason: "   " }),
      routeParams(BATCH_ID),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON body", async () => {
    mockSupplierClient({});
    const req = new NextRequest("http://localhost/api/suppliers/batches/x/cancel", {
      method: "POST",
      body: "{not json",
    });
    const res = await cancelBatch(req, routeParams(BATCH_ID));
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    mockSupplierClient({ user: null, profile: null });
    const res = await cancelBatch(
      postJson("/api/suppliers/batches/x/cancel", { reason: "x" }),
      routeParams(BATCH_ID),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-supplier role", async () => {
    mockSupplierClient({
      profile: { role: "umkm", status: "active", full_name: "Buyer" },
    });
    const res = await cancelBatch(
      postJson("/api/suppliers/batches/x/cancel", { reason: "x" }),
      routeParams(BATCH_ID),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for a suspended supplier", async () => {
    mockSupplierClient({
      profile: {
        role: "supplier",
        status: "suspended_temporary",
        full_name: "Supplier",
      },
    });
    const res = await cancelBatch(
      postJson("/api/suppliers/batches/x/cancel", { reason: "x" }),
      routeParams(BATCH_ID),
    );
    expect(res.status).toBe(403);
  });

  it("returns 500 when the rpc fails", async () => {
    const { rpc } = mockSupplierClient({});
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await cancelBatch(
      postJson("/api/suppliers/batches/x/cancel", { reason: "x" }),
      routeParams(BATCH_ID),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
