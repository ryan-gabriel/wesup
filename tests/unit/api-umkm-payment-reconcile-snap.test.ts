import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/payments/order-lock", () => ({ acquirePaymentLock: vi.fn(async () => ({acquired:true,token:"owned"})), releasePaymentLock: vi.fn(async () => {}) }));
vi.mock("@/lib/umkm/workspace-auth", () => ({ resolveActiveUmkm: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => {
  class SupabaseAdminConfigurationError extends Error {
    constructor() {
      super("Missing Supabase admin key configuration.");
      this.name = "SupabaseAdminConfigurationError";
    }
  }
  return { getAdminClient: vi.fn(), SupabaseAdminConfigurationError };
});
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/payments/midtrans", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/midtrans")>("@/lib/payments/midtrans");
  return { ...actual, getTransactionStatus: vi.fn() };
});

import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { getAdminClient, SupabaseAdminConfigurationError } from "@/lib/supabase/admin";
import { getTransactionStatus, MidtransProviderError } from "@/lib/payments/midtrans";
import { acquirePaymentLock } from "@/lib/payments/order-lock";
import { POST } from "@/app/api/umkm/orders/[orderId]/payment/reconcile/route";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function chain(result: unknown) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function setup() {
  const paymentQuery = chain({ data: { id: "pay-1", status: "pending", midtrans_order_id: "WESUP-legacy", gross_amount: 120000, registration: { id: ORDER_ID, status: "pending_payment" } }, error: null });
  const attemptQuery = chain({ data: { id: "attempt-1", payment_id: "pay-1", provider_order_id: "WESUP-snap-1", status: "pending", integration_type: "snap", provider_status: "pending", expires_at: "2099-09-15T00:00:00.000Z" }, error: null });
  const payment = {id:"pay-1",status:"pending",midtrans_order_id:"WESUP-legacy",gross_amount:120000,registration:{id:ORDER_ID,status:"pending_payment"},payment_attempts:[{id:"attempt-1",provider_order_id:"WESUP-snap-1",status:"pending",integration_type:"snap",provider_status:"pending",expires_at:"2099-09-15T00:00:00Z"}]};
  paymentQuery.maybeSingle = vi.fn(async () => ({data:payment,error:null}));
  const rpc = vi.fn(async (name: string, args: Record<string,unknown>) => { if(name === "apply_midtrans_payment_event" && args.p_provider_status === "settlement") {payment.status="paid";payment.registration.status="paid";payment.payment_attempts[0].status="paid";} return {data:{registrationStatus:payment.registration.status},error:null}; });
  const admin = { from: vi.fn((table: string) => table === "payment_attempts" ? attemptQuery : paymentQuery), rpc };
  const client = { from: vi.fn(() => paymentQuery) };
  vi.mocked(resolveActiveUmkm).mockResolvedValue({ client, context: { userId: USER_ID, role: "umkm", status: "active" } as never, response: null });
  vi.mocked(getAdminClient).mockReturnValue(admin as never);
  return { admin, rpc, payment, attemptQuery };
}

describe("UMKM Snap payment reconciliation", () => {
  it("does not materialize or penalize an uncertain provider response",async()=>{
    const {rpc,payment}=setup();
    vi.mocked(getTransactionStatus).mockRejectedValue(new MidtransProviderError("unavailable",503,true));
    const response=await POST(new NextRequest("http://localhost",{method:"POST"}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(response.status).toBe(503);expect(rpc).not.toHaveBeenCalled();
    expect(payment.registration.status).toBe("pending_payment");expect(payment.payment_attempts[0].status).toBe("pending");
  });
  it("keeps a 404 after a selected payment method uncertain and blocks new checkout",async()=>{
    setup().payment.payment_attempts.forEach(a=>Object.assign(a,{payment_type:"qris"}));
    vi.mocked(getTransactionStatus).mockRejectedValue(new MidtransProviderError("not found",404,false));
    const response=await POST(new NextRequest("http://localhost",{method:"POST"}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({status:null,reconciled:false,paymentProgress:{state:"status_unknown",canOpenCheckout:false,canCheckStatus:true}});
  });
  it("does not contact Midtrans while checkout owns the payment lock",async()=>{
    setup();vi.mocked(acquirePaymentLock).mockResolvedValueOnce({acquired:false,token:"busy"});
    const response=await POST(new NextRequest("http://localhost",{method:"POST"}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(response.status).toBe(409);expect(getTransactionStatus).not.toHaveBeenCalled();
  });
  it("uses the refreshed refund status instead of reporting a settlement as paid", async () => {
    const {rpc,payment}=setup();
    rpc.mockImplementation((async()=> {payment.status="paid";payment.registration.status="refund_pending";return {data:{registrationStatus:"refund_pending"},error:null};}) as never);
    vi.mocked(getTransactionStatus).mockResolvedValue({orderId:"WESUP-snap-1",transactionId:"tx",transactionStatus:"settlement",qrCodeUrl:null,expiresAt:null,raw:{order_id:"WESUP-snap-1",gross_amount:"120000.00",transaction_status:"settlement"}});
    const result=await POST(new NextRequest("http://localhost",{method:"POST"}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(await result.json()).toMatchObject({localStatus:"refund_pending",paymentProgress:{state:"refund_pending",canOpenCheckout:false}});
  });
  it("rejects a different amount before mutating payment state",async()=>{
    const {rpc}=setup();
    vi.mocked(getTransactionStatus).mockResolvedValue({orderId:"WESUP-snap-1",transactionId:"tx",transactionStatus:"settlement",qrCodeUrl:null,expiresAt:null,raw:{order_id:"WESUP-snap-1",gross_amount:"1.00",transaction_status:"settlement"}});
    const result=await POST(new NextRequest("http://localhost",{method:"POST"}),{params:Promise.resolve({orderId:ORDER_ID})});
    expect(result.status).toBe(502);expect(rpc).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats Midtrans 404 before method selection as pending", async () => {
    setup();
    vi.mocked(getTransactionStatus).mockRejectedValue(new MidtransProviderError("not found", 404, false));
    const response = await POST(new NextRequest(`http://localhost/api/umkm/orders/${ORDER_ID}/payment/reconcile`, { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: "not_created", reconciled: false }));
  });

  it("closes an uncertain Snap checkout that Midtrans never created so payment can be retried", async () => {
    const { payment, attemptQuery } = setup();
    payment.payment_attempts[0].provider_status = "creation_unknown";
    Object.assign(payment.registration, { batch: { batch_timeline: { payment_opens_at: "2020-01-01T00:00:00Z", payment_closes_at: "2099-01-01T00:00:00Z" } } });
    attemptQuery.update = vi.fn((row: Record<string, unknown>) => { Object.assign(payment.payment_attempts[0], row); return attemptQuery; });
    vi.mocked(getTransactionStatus).mockRejectedValue(new MidtransProviderError("not found", 404, false));
    const response = await POST(new NextRequest(`http://localhost/api/umkm/orders/${ORDER_ID}/payment/reconcile`, { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(attemptQuery.update).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", provider_status: "not_created" }));
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: "not_created", paymentProgress: expect.objectContaining({ state: "failed", canOpenCheckout: true }) }));
  });

  it("applies successful provider events through the atomic Snap RPC", async () => {
    const { admin, rpc } = setup();
    vi.mocked(getTransactionStatus).mockResolvedValue({ orderId: "WESUP-snap-1", transactionId: "tx-1", transactionStatus: "settlement", qrCodeUrl: null, expiresAt: null, raw: { order_id: "WESUP-snap-1",gross_amount:"120000.00",transaction_status:"settlement" } });
    const response = await POST(new NextRequest(`http://localhost/api/umkm/orders/${ORDER_ID}/payment/reconcile`, { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(response.status).toBe(200);
    expect(getTransactionStatus).toHaveBeenCalledWith("WESUP-snap-1");
    expect(rpc).toHaveBeenCalledWith("apply_midtrans_payment_event", expect.objectContaining({ p_payment_attempt_id: "attempt-1", p_provider_status: "settlement", p_provider_transaction_id: "tx-1", p_payload:expect.objectContaining({_wesup_audit:{source:"payment_reconciliation",requestId:expect.any(String)}}) }));
    expect(admin.from).toHaveBeenCalledWith("payment_attempts");
  });

  it("materializes the order after an active Snap attempt expires", async () => {
    const { rpc, payment } = setup();
    rpc.mockImplementation((async (name?: string) => name === "materialize_umkm_order"
      ? (payment.registration.status="cancelled", { data: "cancelled", error: null })
      : { data: { registration_status: "pending_payment" }, error: null }) as never);
    vi.mocked(getTransactionStatus).mockResolvedValue({ orderId: "WESUP-snap-1", transactionId: "tx-expire", transactionStatus: "expire", qrCodeUrl: null, expiresAt: null, raw: { order_id: "WESUP-snap-1",gross_amount:"120000.00",transaction_status:"expire" } });
    const response = await POST(new NextRequest(`http://localhost/api/umkm/orders/${ORDER_ID}/payment/reconcile`, { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_midtrans_payment_event", expect.objectContaining({ p_provider_status: "expire" }));
    expect(rpc).toHaveBeenCalledWith("materialize_umkm_order", { p_registration_id: ORDER_ID });
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: "expire", localStatus: "cancelled", reconciled: true }));
  });

  it("records a transaction log when finalizing a legacy payment without an attempt", async () => {
    const paymentQuery = chain({ data: { id: "pay-1", status: "pending", midtrans_order_id: "WESUP-legacy", gross_amount: 120000, registration: { id: ORDER_ID, status: "pending_payment" } }, error: null });
    const attemptQuery = chain({ data: null, error: null });
    const rpc = vi.fn(async () => {paymentQuery.maybeSingle = vi.fn(async()=>({data:{id:"pay-1",status:"paid",registration:{id:ORDER_ID,status:"paid"}},error:null}));return { data: { local_status: "paid" }, error: null };});
    const admin = { from: vi.fn((table: string) => table === "payment_attempts" ? attemptQuery : paymentQuery), rpc };
    const client = { from: vi.fn(() => paymentQuery) };
    vi.mocked(resolveActiveUmkm).mockResolvedValue({ client, context: { userId: USER_ID, role: "umkm", status: "active" } as never, response: null });
    vi.mocked(getAdminClient).mockReturnValue(admin as never);
    vi.mocked(getTransactionStatus).mockResolvedValue({ orderId: "WESUP-legacy", transactionId: "tx-legacy", transactionStatus: "settlement", qrCodeUrl: null, expiresAt: null, raw: { order_id: "WESUP-legacy",gross_amount:"120000.00",transaction_status:"settlement", fraud_status: "accept" } });

    const response = await POST(new NextRequest(`http://localhost/api/umkm/orders/${ORDER_ID}/payment/reconcile`, { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("finalize_payment", expect.objectContaining({ p_registration_id: ORDER_ID, p_midtrans_transaction_id: "tx-legacy" }));
    expect(rpc).toHaveBeenCalledWith("record_transaction_log", expect.objectContaining({ p_registration_id: ORDER_ID, p_payment_id: "pay-1", p_event_type: "payment_status_change", p_from_status: "pending", p_to_status: "paid", p_provider_status: "settlement", p_source: "reconcile" }));
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: "settlement", localStatus: "paid", reconciled: true }));
  });

  it("returns a typed configuration error when the admin client is unavailable", async () => {
    setup();
    vi.mocked(getAdminClient).mockImplementation(() => { throw new SupabaseAdminConfigurationError(); });
    const response = await POST(new NextRequest(`http://localhost/api/umkm/orders/${ORDER_ID}/payment/reconcile`, { method: "POST" }), { params: Promise.resolve({ orderId: ORDER_ID }) });
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ code: "PAYMENT_ADMIN_CONFIG_MISSING", requestId: expect.any(String) }));
    expect(response.status).toBe(503);
    expect(getTransactionStatus).not.toHaveBeenCalled();
  });
});
