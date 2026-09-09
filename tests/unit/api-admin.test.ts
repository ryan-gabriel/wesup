import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as approveSupplier } from "@/app/api/admin/suppliers/[id]/approve/route";
import { POST as rejectSupplier } from "@/app/api/admin/suppliers/[id]/reject/route";
import { POST as takedownBatch } from "@/app/api/admin/batches/[id]/takedown/route";
import { POST as resolveDispute } from "@/app/api/admin/disputes/[id]/resolve/route";
import { POST as approveRefund } from "@/app/api/admin/refunds/[id]/approve/route";
import { POST as completeRefund } from "@/app/api/admin/refunds/[id]/complete/route";
import { POST as suspendUser } from "@/app/api/admin/users/[id]/suspend/route";
import { POST as banUser } from "@/app/api/admin/users/[id]/ban/route";
import { POST as unbanUser } from "@/app/api/admin/users/[id]/unban/route";
import { GET as listAuditLogs } from "@/app/api/admin/audit-logs/route";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/supabase/server", () => ({
  getServerClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(),
}));

const mockGetServerClient = vi.mocked(getServerClient);

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";

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

function postBadJson(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    body: "{not json",
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

interface SessionOptions {
  user?: { id: string; email?: string } | null;
  profile?: { role: string; status: string; full_name: string } | null;
}

function mockAdminClient(options: SessionOptions) {
  const getUser = vi.fn(async () =>
    options.user === undefined
      ? { data: { user: { id: ADMIN_ID, email: "admin@example.com" }, error: null } }
      : { data: { user: options.user }, error: null },
  );
  const single = vi.fn(async () =>
    options.profile === undefined
      ? { data: { role: "admin", status: "active", full_name: "Admin" }, error: null }
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
  return { client, rpc, single };
}

function mockAuditLogsClient(rows: unknown[] = []) {
  const getUser = vi.fn(async () => ({
    data: { user: { id: ADMIN_ID, email: "admin@example.com" }, error: null },
  }));
  const single = vi.fn(async () => ({
    data: { role: "admin", status: "active", full_name: "Admin" },
    error: null,
  }));
  const range = vi.fn(async () => ({ data: rows, error: null }));
  const order = vi.fn(() => ({ range }));
  const eq = vi.fn(() => ({ eq, order }));
  const select = vi.fn(() => ({ eq, order }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })) };
    }
    return { select };
  });
  const client = { auth: { getUser }, from };
  mockGetServerClient.mockResolvedValue(client as unknown as SupabaseClient<Database>);
  return { client, eq, order, range, select };
}

describe("POST /api/admin/suppliers/[id]/approve", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
    vi.mocked(enforceRateLimit).mockReset();
    vi.mocked(enforceRateLimit).mockResolvedValue(null);
  });

  it("returns 429 when the rate limiter blocks the request", async () => {
    mockAdminClient({});
    vi.mocked(enforceRateLimit).mockResolvedValueOnce(
      NextResponse.json({ error: "rate_limited" }, { status: 429 }),
    );
    const res = await approveSupplier(
      postJson(`/api/admin/suppliers/${TARGET_ID}/approve`, {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(429);
  });

  it("returns 200 and calls approve_supplier rpc with ip and user agent", async () => {
    const { rpc } = mockAdminClient({});
    const req = postJson("/api/admin/suppliers/x/approve", {}, {
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "test-agent",
    });
    const res = await approveSupplier(req, routeParams(TARGET_ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("approve_supplier", {
      p_user_id: TARGET_ID,
      p_ip_address: "1.2.3.4",
      p_user_agent: "test-agent",
    });
  });

  it("returns 400 for an invalid supplier id", async () => {
    mockAdminClient({});
    const res = await approveSupplier(
      postJson("/api/admin/suppliers/x/approve", {}),
      routeParams("not-a-uuid"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    mockAdminClient({ user: null, profile: null });
    const res = await approveSupplier(
      postJson("/api/admin/suppliers/x/approve", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin role", async () => {
    mockAdminClient({
      profile: { role: "umkm", status: "active", full_name: "Buyer" },
    });
    const res = await approveSupplier(
      postJson("/api/admin/suppliers/x/approve", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 for a suspended admin", async () => {
    mockAdminClient({
      profile: { role: "admin", status: "suspended_temporary", full_name: "Admin" },
    });
    const res = await approveSupplier(
      postJson("/api/admin/suppliers/x/approve", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(403);
  });

  it("returns 500 when the rpc fails", async () => {
    const { rpc } = mockAdminClient({});
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await approveSupplier(
      postJson("/api/admin/suppliers/x/approve", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Internal server error" });
  });
});

describe("POST /api/admin/suppliers/[id]/reject", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 and calls reject_supplier with reason", async () => {
    const { rpc } = mockAdminClient({});
    const res = await rejectSupplier(
      postJson("/api/admin/suppliers/x/reject", { reason: "KTP unclear" }),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("reject_supplier", {
      p_user_id: TARGET_ID,
      p_reason: "KTP unclear",
      p_ip_address: null,
      p_user_agent: null,
    });
  });

  it("returns 400 when reason is missing", async () => {
    mockAdminClient({});
    const res = await rejectSupplier(
      postJson("/api/admin/suppliers/x/reject", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Rejection reason is required",
    });
  });

  it("returns 400 for malformed JSON", async () => {
    mockAdminClient({});
    const res = await rejectSupplier(
      postBadJson("/api/admin/suppliers/x/reject"),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/batches/[id]/takedown", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 and calls takedown_batch with reason", async () => {
    const { rpc } = mockAdminClient({});
    const res = await takedownBatch(
      postJson("/api/admin/batches/x/takedown", { reason: "Violation" }),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("takedown_batch", {
      p_batch_id: TARGET_ID,
      p_reason: "Violation",
      p_ip_address: null,
      p_user_agent: null,
    });
  });

  it("returns 400 when reason is missing", async () => {
    mockAdminClient({});
    const res = await takedownBatch(
      postJson("/api/admin/batches/x/takedown", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Takedown reason is required",
    });
  });
});

describe("POST /api/admin/disputes/[id]/resolve", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 and calls resolve_dispute with winner supplier", async () => {
    const { rpc } = mockAdminClient({});
    const res = await resolveDispute(
      postJson("/api/admin/disputes/x/resolve", { winner: "supplier", notes: "ok" }),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("resolve_dispute", {
      p_dispute_id: TARGET_ID,
      p_winner: "supplier",
      p_notes: "ok",
      p_ip_address: null,
      p_user_agent: null,
    });
  });

  it("returns 400 for an invalid winner", async () => {
    mockAdminClient({});
    const res = await resolveDispute(
      postJson("/api/admin/disputes/x/resolve", { winner: "both" }),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "winner must be supplier or umkm",
    });
  });

  it("returns 409 when the dispute is already resolved (irreversible)", async () => {
    const { rpc } = mockAdminClient({});
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "dispute already resolved" },
    });
    const res = await resolveDispute(
      postJson("/api/admin/disputes/x/resolve", { winner: "supplier" }),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(409);
  });
});

describe("POST /api/admin/refunds/[id]/approve", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 and calls approve_refund", async () => {
    const { rpc } = mockAdminClient({});
    const res = await approveRefund(
      postJson("/api/admin/refunds/x/approve", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("approve_refund", {
      p_refund_id: TARGET_ID,
      p_ip_address: null,
      p_user_agent: null,
    });
  });
});

describe("POST /api/admin/refunds/[id]/complete", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 and calls complete_refund with transfer proof", async () => {
    const { rpc } = mockAdminClient({});
    const res = await completeRefund(
      postJson("/api/admin/refunds/x/complete", {
        transfer_proof_url: "https://storage.example.com/proof.jpg",
      }),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("complete_refund", {
      p_refund_id: TARGET_ID,
      p_transfer_proof_url: "https://storage.example.com/proof.jpg",
      p_ip_address: null,
      p_user_agent: null,
    });
  });

  it("returns 400 when transfer proof is missing", async () => {
    mockAdminClient({});
    const res = await completeRefund(
      postJson("/api/admin/refunds/x/complete", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-http transfer proof url", async () => {
    mockAdminClient({});
    const res = await completeRefund(
      postJson("/api/admin/refunds/x/complete", { transfer_proof_url: "ftp://x" }),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/users/[id]/suspend", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 and calls suspend_user with a future timestamp", async () => {
    const { rpc } = mockAdminClient({});
    const until = new Date(Date.now() + 7 * 86400_000).toISOString();
    const res = await suspendUser(
      postJson("/api/admin/users/x/suspend", { suspended_until: until }),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("suspend_user", {
      p_user_id: TARGET_ID,
      p_suspended_until: until,
      p_ip_address: null,
      p_user_agent: null,
    });
  });

  it("returns 400 when suspended_until is missing or not a timestamp", async () => {
    mockAdminClient({});
    const res = await suspendUser(
      postJson("/api/admin/users/x/suspend", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "suspended_until must be a valid ISO timestamp",
    });
  });
});

describe("POST /api/admin/users/[id]/ban and unban", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 and calls ban_user", async () => {
    const { rpc } = mockAdminClient({});
    const res = await banUser(
      postJson("/api/admin/users/x/ban", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("ban_user", {
      p_user_id: TARGET_ID,
      p_ip_address: null,
      p_user_agent: null,
    });
  });

  it("returns 200 and calls unban_user", async () => {
    const { rpc } = mockAdminClient({});
    const res = await unbanUser(
      postJson("/api/admin/users/x/unban", {}),
      routeParams(TARGET_ID),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("unban_user", {
      p_user_id: TARGET_ID,
      p_ip_address: null,
      p_user_agent: null,
    });
  });
});

describe("GET /api/admin/audit-logs", () => {
  beforeEach(() => {
    mockGetServerClient.mockReset();
  });

  it("returns 200 with logs ordered by created_at desc and paginated", async () => {
    const rows = [{ id: "log-1", action_type: "ban_user" }];
    const { range, order } = mockAuditLogsClient(rows);
    const res = await listAuditLogs(
      new NextRequest("http://localhost/api/admin/audit-logs?limit=10&offset=5"),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ logs: rows });
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(range).toHaveBeenCalledWith(5, 14);
  });

  it("applies action_type and admin_id filters", async () => {
    const { eq } = mockAuditLogsClient([]);
    const res = await listAuditLogs(
      new NextRequest(
        "http://localhost/api/admin/audit-logs?action_type=ban_user&admin_id=" + ADMIN_ID,
      ),
    );
    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("action_type", "ban_user");
    expect(eq).toHaveBeenCalledWith("admin_id", ADMIN_ID);
  });

  it("returns 400 for an invalid limit", async () => {
    mockAuditLogsClient();
    const res = await listAuditLogs(
      new NextRequest("http://localhost/api/admin/audit-logs?limit=0"),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "limit must be an integer between 1 and 100",
    });
  });

  it("returns 400 for an invalid offset", async () => {
    mockAuditLogsClient();
    const res = await listAuditLogs(
      new NextRequest("http://localhost/api/admin/audit-logs?offset=-1"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown action_type", async () => {
    mockAuditLogsClient();
    const res = await listAuditLogs(
      new NextRequest("http://localhost/api/admin/audit-logs?action_type=hack"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid admin_id", async () => {
    mockAuditLogsClient();
    const res = await listAuditLogs(
      new NextRequest("http://localhost/api/admin/audit-logs?admin_id=nope"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when not signed in", async () => {
    const { client } = mockAuditLogsClient();
    const getUser = client.auth.getUser as ReturnType<typeof vi.fn>;
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await listAuditLogs(
      new NextRequest("http://localhost/api/admin/audit-logs"),
    );
    expect(res.status).toBe(401);
  });
});
