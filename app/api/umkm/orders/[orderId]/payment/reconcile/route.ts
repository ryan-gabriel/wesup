import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/admin/validation";
import { getAdminClient, SupabaseAdminConfigurationError } from "@/lib/supabase/admin";
import { resolveActiveUmkm } from "@/lib/umkm/workspace-auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getTransactionStatus, isExpiredTransaction, isSuccessfulTransaction, MidtransProviderError } from "@/lib/payments/midtrans";
import { acquirePaymentLock, releasePaymentLock } from "@/lib/payments/order-lock";
import { derivePaymentProgress, selectPaymentAttempt } from "@/lib/payments/progress";
import { providerPaymentMismatch } from "@/lib/payments/provider-validation";

export const dynamic = "force-dynamic";
type Result = { data?: unknown; error?: unknown };
type Query = PromiseLike<Result> & { select: (columns: string) => Query; eq: (column: string, value: unknown) => Query; update: (row: Record<string, unknown>) => Query; maybeSingle: () => PromiseLike<Result> };
type Client = { from: (table: string) => Query; rpc: (name: string, args: Record<string, unknown>) => PromiseLike<Result> };
const SELECT = "id,status,midtrans_order_id,gross_amount,qr_code_url,midtrans_transaction_id,reconciled_at,payment_attempts(id,provider_order_id,status,integration_type,provider_status,provider_checked_at,payment_type,expires_at,created_at),registration:registrations!inner(id,status,umkm_id,locked_price_per_unit,batch:batches(batch_timeline(payment_opens_at,payment_closes_at,effective_payment_opens_at,effective_payment_closes_at)))";
function fail(error: string, code: string, status: number) { return NextResponse.json({ error, code, requestId: randomUUID() }, { status }); }
const object = (value: unknown): Record<string, unknown> => (Array.isArray(value) ? value[0] : value) as Record<string, unknown> ?? {};
function responseFor(payment: Record<string, unknown>, providerStatus: string | null, reconciled: boolean, transactionId: string | null = null, unknown = false, canTransact = true) {
  const registration = object(payment.registration);
  const timeline = object(object(registration.batch).batch_timeline);
  const attempts = Array.isArray(payment.payment_attempts) ? payment.payment_attempts as Array<Record<string, unknown>> : [];
  const attempt = selectPaymentAttempt(attempts);
  const serverTime = new Date().toISOString();
  const progress = derivePaymentProgress({status: String(registration.status),invoiceStatus: payment.status,providerOrderId: payment.midtrans_order_id,attempt,now: serverTime,opensAt: String(timeline.effective_payment_opens_at ?? timeline.payment_opens_at ?? "") || null,closesAt: String(timeline.effective_payment_closes_at ?? timeline.payment_closes_at ?? "") || null,lastCheckedAt: typeof payment.reconciled_at === "string" ? payment.reconciled_at : null,hasLegacyCheckout:Boolean(payment.qr_code_url||payment.midtrans_transaction_id)});
  if (unknown && !["paid","refund_pending","refunded"].includes(progress.state)) { progress.state = "status_unknown"; progress.canOpenCheckout = false; progress.blockedReason = "Periksa status pembayaran sebelum membayar ulang."; }
  if (!canTransact) {progress.canOpenCheckout = false;progress.blockedReason = "Akun ditangguhkan. Anda tetap dapat memeriksa pembayaran pesanan ini.";}
  return NextResponse.json({ status: providerStatus, localStatus: registration.status, invoiceStatus: payment.status, attemptStatus: attempt?.status ?? null, paymentType: attempt?.payment_type ?? null, transactionId, reconciled, serverTime, paymentProgress: progress, lastCheckedAt: progress.lastCheckedAt, canOpenCheckout: progress.canOpenCheckout, canCheckStatus: progress.canCheckStatus, blockedReason: progress.blockedReason, lockedUnitPrice: registration.locked_price_per_unit == null ? null : Number(registration.locked_price_per_unit) });
}
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const viewer = await resolveActiveUmkm({allowSuspended: true});
  if (!viewer.client) return viewer.response;
  const { orderId } = await params;
  if (!isUuid(orderId)) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const limited = await enforceRateLimit(request, "route", viewer.context.userId);
  if (limited) return limited;
  const client = viewer.client as Client;
  const read = () => client.from("payments").select(SELECT).eq("registration_id", orderId).eq("registration.umkm_id", viewer.context.userId).maybeSingle();
  const found = await read();
  if (found.error) return fail("Pembayaran belum dapat dimuat", "PAYMENT_READ_FAILED", 503);
  if (!found.data) return fail("Pesanan tidak ditemukan", "ORDER_NOT_FOUND", 404);
  const payment = object(found.data);
  if (payment.status === "paid" && ["paid","picked_up","completed","refund_pending","refunded"].includes(String(object(payment.registration).status))) return responseFor(payment, "settlement", false, null, false, viewer.context.status === "active");
  const lock = await acquirePaymentLock(orderId);
  if (!lock.acquired) return fail("Pembayaran sedang diperiksa. Tunggu sebentar, lalu coba lagi.", "PAYMENT_BUSY", 409);
  try {
    let admin: Client;
    try { admin = getAdminClient() as unknown as Client; }
    catch (error) { return fail("Layanan pembayaran belum siap.", error instanceof SupabaseAdminConfigurationError ? "PAYMENT_ADMIN_CONFIG_MISSING" : "PAYMENT_ADMIN_INIT_FAILED", 503); }
    const attempts = Array.isArray(payment.payment_attempts) ? payment.payment_attempts as Array<Record<string, unknown>> : [];
    const attempt = selectPaymentAttempt(attempts);
    const providerOrderId = String(attempt?.provider_order_id ?? payment.midtrans_order_id ?? "");
    if (!providerOrderId) return fail("Percobaan pembayaran tidak ditemukan", "PAYMENT_ATTEMPT_NOT_FOUND", 409);
    let provider;
    try { provider = await getTransactionStatus(providerOrderId); }
    catch (error) {
      if (error instanceof MidtransProviderError && error.status === 404) {
        const beforeMethod = attempt?.integration_type === "snap" && !attempt.payment_type && ["pending", "creation_unknown"].includes(String(attempt.provider_status));
        if (attempt?.id && beforeMethod) {
          const expiredCheckout = Date.parse(String(attempt.expires_at ?? "")) <= Date.now();
          // Midtrans tidak mengenal order ini: tidak ada checkout yang bisa dibayar, jadi attempt ditutup
          // supaya UMKM dapat membuat checkout baru (tanpa ini attempt macet selamanya).
          const notCreated = attempt.provider_status === "creation_unknown";
          const saved = await admin.from("payment_attempts").update({provider_checked_at: new Date().toISOString(), ...(expiredCheckout ? {status:"expired",provider_status:"snap_expired"} : notCreated ? {status:"failed",provider_status:"not_created"} : {})}).eq("id", attempt.id);
          if (saved.error) return fail("Hasil pemeriksaan belum dapat disimpan", "PAYMENT_CHECK_SAVE_FAILED", 503);
        }
        const refreshed = await read();
        if (refreshed.error || !refreshed.data) return fail("Hasil pemeriksaan belum dapat dimuat", "PAYMENT_READ_FAILED", 503);
        return responseFor(object(refreshed.data), beforeMethod ? "not_created" : null, false, null, !beforeMethod, viewer.context.status === "active");
      }
      return fail("Midtrans belum dapat dihubungi. Status pembayaran belum berubah; coba periksa kembali.", "PAYMENT_PROVIDER_UNAVAILABLE", 503);
    }
    const mismatch = providerPaymentMismatch(provider.raw, providerOrderId, Number(payment.gross_amount), process.env.MIDTRANS_MERCHANT_ID?.trim());
    if (mismatch) {
      const requestId = randomUUID();
      console.error("[payment-reconcile] provider mismatch", {requestId, category:mismatch});
      return NextResponse.json({error:"Hasil pemeriksaan tidak sesuai tagihan. Hubungi bantuan transaksi.",code:"PAYMENT_PROVIDER_MISMATCH",requestId},{status:502});
    }
    const status = provider.transactionStatus.toLowerCase();
    const payload:Record<string,unknown> = { ...provider.raw, _wesup_audit:{source:"payment_reconciliation",requestId:randomUUID()} };
    for (const key of ["token","snap_token","signature_key","card"]) delete payload[key];
    if (attempt?.id) {
      const event = await admin.rpc("apply_midtrans_payment_event", { p_payment_attempt_id: String(attempt.id), p_provider_status: status, p_provider_transaction_id: provider.transactionId, p_payment_type: typeof provider.raw.payment_type === "string" ? provider.raw.payment_type : null, p_fraud_status: typeof provider.raw.fraud_status === "string" ? provider.raw.fraud_status : null, p_payload: payload });
      if (event.error) return fail("Pembayaran terdeteksi tetapi belum dapat disimpan", "PAYMENT_FINALIZE_FAILED", 503);
      const saved = await admin.from("payment_attempts").update({provider_checked_at: new Date().toISOString()}).eq("id", attempt.id);
      if (saved.error) return fail("Hasil pemeriksaan belum dapat disimpan", "PAYMENT_CHECK_SAVE_FAILED", 503);
    } else if (isSuccessfulTransaction(status)) {
      const event = await admin.rpc("finalize_payment", { p_registration_id: orderId, p_midtrans_transaction_id: provider.transactionId, p_payload: payload });
      if (event.error) return fail("Pembayaran terdeteksi tetapi belum dapat disimpan", "PAYMENT_FINALIZE_FAILED", 503);
      await admin.rpc("record_transaction_log", {p_registration_id:orderId,p_payment_id:payment.id,p_payment_attempt_id:null,p_event_type:"payment_status_change",p_from_status:payment.status,p_to_status:"paid",p_provider_status:status,p_gateway_transaction_id:provider.transactionId,p_source:"reconcile",p_payload:payload});
    } else if (isExpiredTransaction(status) && !["paid", "refunded"].includes(String(payment.status))) {
      const registration = object(payment.registration);
      const timeline = object(object(registration.batch).batch_timeline);
      const windowOpen = Date.now() >= Date.parse(String(timeline.effective_payment_opens_at ?? timeline.payment_opens_at)) && Date.now() < Date.parse(String(timeline.effective_payment_closes_at ?? timeline.payment_closes_at));
      const saved = await admin.from("payments").update({status: windowOpen && registration.status === "pending_payment" ? "pending" : status === "expire" ? "expired" : "failed",reconciled_at: new Date().toISOString()}).eq("id",payment.id).eq("status",String(payment.status));
      if (saved.error) return fail("Hasil pemeriksaan belum dapat disimpan", "PAYMENT_CHECK_SAVE_FAILED", 503);
    }
    if (isExpiredTransaction(status)) {
      const materialized = await admin.rpc("materialize_umkm_order", {p_registration_id:orderId});
      if (materialized.error) return fail("Status pembayaran belum dapat diselesaikan", "PAYMENT_RECONCILE_FAILED", 503);
    }
    const refreshed = await read();
    if (refreshed.error || !refreshed.data) return fail("Hasil pemeriksaan belum dapat dimuat", "PAYMENT_READ_FAILED", 503);
    return responseFor(object(refreshed.data), status, true, provider.transactionId, false, viewer.context.status === "active");
  } finally { await releasePaymentLock(orderId, lock.token); }
}
