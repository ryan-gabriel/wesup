import type { UmkmOrderDetail } from "@/lib/orders/api-types";
import { isUuid } from "@/lib/admin/validation";
export interface PaymentDemo { enabled: boolean; canSimulatePaid: boolean; blockedReason: string | null; checkoutReference: string | null; }
type DemoEnv = Record<string, string | undefined>;
function allowed(value: string | undefined, id: string) {
  const ids = (value ?? "").split(",").map(s => s.trim());
  return ids.length > 0 && ids.every(isUuid) && ids.includes(id);
}
export function paymentDemoEnabled(userId: string, batchId: string, env: DemoEnv = process.env) {
  return env.PAYMENT_DEMO_ENABLED === "true" && env.MIDTRANS_IS_PRODUCTION === "false"
    && allowed(env.PAYMENT_DEMO_ALLOWED_UMKM_IDS,userId) && allowed(env.PAYMENT_DEMO_ALLOWED_BATCH_IDS,batchId);
}
export function paymentDemoFor(order: UmkmOrderDetail, userId: string, active: boolean, env: DemoEnv = process.env): PaymentDemo {
  const enabled = paymentDemoEnabled(userId,order.batchId,env);
  const denied = (reason: string): PaymentDemo => ({enabled,canSimulatePaid:false,blockedReason:reason,checkoutReference:null});
  if (!enabled) return denied("Simulasi pembayaran tidak tersedia.");
  if (!active) return denied("Akun ditangguhkan.");
  if (order.status !== "pending_payment" || order.invoice?.status !== "pending" || !["published","closed"].includes(order.batchStatus ?? "")) return denied("Status pesanan tidak memenuhi syarat simulasi.");
  if (!Number.isFinite(order.finalAmount) || !order.finalAmount || order.finalAmount <= 0 || order.invoice.grossAmount !== order.finalAmount || order.lockedTier == null) return denied("Tagihan final tidak konsisten.");
  const now=Date.parse(order.serverTime), opens=Date.parse(order.timeline.paymentOpensAt ?? ""), closes=Date.parse(order.timeline.paymentClosesAt ?? "");
  if (!(now >= opens && now < closes)) return denied("Simulasi hanya tersedia selama jendela pembayaran.");
  const a=order.paymentAttempt;
  let ref: string | null=null;
  if (a) {
    if (a.checkoutMode === "core_qris" && !a.qrCodeUrl) return denied("QR pembayaran belum tersimpan. Buat checkout yang sah terlebih dahulu.");
    if (a.status !== "pending" || !["pending","not_created"].includes(a.providerStatus ?? "pending") || !a.providerOrderId || !(Date.parse(a.expiresAt ?? "") > now)) return denied("Checkout belum siap atau telah kedaluwarsa. Buat checkout yang sah terlebih dahulu.");
    ref=a.providerOrderId;
  } else if (order.invoice.midtransOrderId && order.invoice.qrCodeUrl && Date.parse(order.invoice.qrCodeExpiresAt ?? "") > now) ref=order.invoice.midtransOrderId;
  if (!ref) return denied("Buat checkout pembayaran terlebih dahulu.");
  return {enabled,canSimulatePaid:true,blockedReason:null,checkoutReference:ref};
}
