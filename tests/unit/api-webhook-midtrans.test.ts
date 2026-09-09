import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { POST as webhook } from "@/app/api/webhook/midtrans/route";
import { getAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(),
}));

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
    eval: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: redisMock,
}));

const mockGetAdminClient = vi.mocked(getAdminClient);

const SERVER_KEY = "Mid-server-test-key-123";
const ORDER_ID = "WESUP-ABC123-1700000000000";

function sign(body: Record<string, string>): string {
  return createHash("sha512")
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${SERVER_KEY}`)
    .digest("hex");
}

function notification(overrides: Record<string, string> = {}) {
  const body = {
    order_id: ORDER_ID,
    status_code: "200",
    gross_amount: "50000.00",
    transaction_status: "settlement",
    transaction_id: "trx-001",
    fraud_status: "accept",
    payment_type: "qris",
    ...overrides,
  };
  return { ...body, signature_key: sign(body) };
}

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/webhook/midtrans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface DbOpts {
  payment?: Record<string, unknown> | null;
  paymentError?: { message: string } | null;
  logError?: { message: string } | null;
  paymentUpdateError?: { message: string } | null;
  registrationUpdateError?: { message: string } | null;
}

function mockDb(opts: DbOpts = {}) {
  const single = vi.fn(async () => ({
    data: opts.payment ?? null,
    error: opts.paymentError ?? (opts.payment ? null : { message: "none" }),
  }));
  const paymentUpdate = vi.fn(async () => ({ error: opts.paymentUpdateError ?? null }));
  const registrationUpdate = vi.fn(async () => ({
    error: opts.registrationUpdateError ?? null,
  }));
  const insertLog = vi.fn(async () => ({ error: opts.logError ?? null }));
  const from = vi.fn((table: string) => {
    if (table === "payments") {
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })),
        update: vi.fn(() => ({ eq: paymentUpdate })),
      };
    }
    if (table === "payment_webhook_logs") {
      return { insert: insertLog };
    }
    return { update: vi.fn(() => ({ eq: registrationUpdate })) };
  });
  mockGetAdminClient.mockReturnValue({ from } as unknown as SupabaseClient<Database>);
  return { single, paymentUpdate, registrationUpdate, insertLog };
}

const PAID_PAYMENT = {
  id: "pay-1",
  registration_id: "reg-1",
  status: "paid",
  gross_amount: 50000,
};

const PENDING_PAYMENT = { ...PAID_PAYMENT, status: "pending" };

describe("POST /api/webhook/midtrans", () => {
  beforeEach(() => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", SERVER_KEY);
    vi.stubEnv("APP_ENV", "development");
    mockGetAdminClient.mockReset();
    for (const fn of Object.values(redisMock)) fn.mockReset();
    redisMock.get.mockResolvedValue(null); // QA kill-switch off
    redisMock.set.mockResolvedValue("OK"); // lock acquired
    redisMock.eval.mockResolvedValue(1); // lock released
  });

  it("marks payment + registration paid on settlement (J1)", async () => {
    const db = mockDb({ payment: PENDING_PAYMENT });
    const res = await webhook(post(notification()));
    expect(res.status).toBe(200);
    expect(db.insertLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "settlement",
        status: "processed",
      }),
    );
    expect(db.paymentUpdate).toHaveBeenCalled();
    expect(db.registrationUpdate).toHaveBeenCalled();
    const body = await res.json();
    expect(body.data.status).toBe("paid");
  });

  it("is idempotent: already-paid payment returns 200 without mutating (J2)", async () => {
    const db = mockDb({ payment: PAID_PAYMENT });
    const res = await webhook(post(notification()));
    expect(res.status).toBe(200);
    expect(db.paymentUpdate).not.toHaveBeenCalled();
    expect(db.registrationUpdate).not.toHaveBeenCalled();
  });

  it("rejects forged signatures with 401 and touches nothing (J2)", async () => {
    const db = mockDb({ payment: PENDING_PAYMENT });
    const bad = { ...notification(), gross_amount: "1.00" };
    const res = await webhook(post(bad));
    expect(res.status).toBe(401);
    expect(db.single).not.toHaveBeenCalled();
    expect(db.insertLog).not.toHaveBeenCalled();
  });

  it("rejects amount mismatch with 400 and mutates nothing (J2)", async () => {
    const db = mockDb({
      payment: { ...PENDING_PAYMENT, gross_amount: 75000 },
    });
    // re-sign for the *claimed* amount so signature passes but DB differs
    const claimed = notification({ gross_amount: "50000.00" });
    const res = await webhook(post(claimed));
    expect(res.status).toBe(400);
    expect(db.paymentUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown order id (J2)", async () => {
    mockDb({ payment: null });
    const res = await webhook(post(notification()));
    expect(res.status).toBe(404);
  });

  it("maps expire → payment expired + registration cancelled", async () => {
    const db = mockDb({ payment: PENDING_PAYMENT });
    const res = await webhook(post(notification({ transaction_status: "expire" })));
    expect(res.status).toBe(200);
    expect(db.paymentUpdate).toHaveBeenCalled();
    const body = await res.json();
    expect(body.data.status).toBe("expired");
  });

  it("defers with 202 and mutates nothing when QA disabled the sync (J3)", async () => {
    redisMock.get.mockResolvedValue("1");
    const db = mockDb({ payment: PENDING_PAYMENT });
    const res = await webhook(post(notification()));
    expect(res.status).toBe(202);
    expect(db.paymentUpdate).not.toHaveBeenCalled();
    expect(db.registrationUpdate).not.toHaveBeenCalled();
  });

  it("returns 409 when another worker holds the payment lock", async () => {
    redisMock.set.mockResolvedValue(null);
    const db = mockDb({ payment: PENDING_PAYMENT });
    const res = await webhook(post(notification()));
    expect(res.status).toBe(409);
    expect(db.single).not.toHaveBeenCalled();
  });
});
