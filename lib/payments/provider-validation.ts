const STATUSES = new Set(["pending", "settlement", "capture", "expire", "deny", "cancel", "refund", "partial_refund", "chargeback", "partial_chargeback", "failure"]);
/** A callback or provider response can never settle a different invoice. */
export function validateProviderPayment(raw: Record<string, unknown>, orderId: string, amount: number, merchantId?: string): boolean {
  return providerPaymentMismatch(raw, orderId, amount, merchantId) === null;
}
export function providerPaymentMismatch(raw: Record<string, unknown>, orderId: string, amount: number, merchantId?: string): string | null {
  const gross = Number(raw.gross_amount);
  const status = String(raw.transaction_status ?? "").toLowerCase();
  if (raw.order_id !== orderId) return "order_id";
  if (!Number.isFinite(gross) || !Number.isFinite(amount) || Math.abs(gross - amount) >= 0.005) return "amount";
  if (!STATUSES.has(status)) return "status";
  if (raw.currency && raw.currency !== "IDR") return "currency";
  if (merchantId && raw.merchant_id !== merchantId) return "merchant";
  if (((status === "capture" || status === "settlement") && raw.fraud_status && raw.fraud_status !== "accept") || (status === "capture" && raw.fraud_status !== "accept")) return "fraud";
  return null;
}
