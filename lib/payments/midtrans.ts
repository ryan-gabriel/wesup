import { createHash, timingSafeEqual } from "node:crypto";

/** Redis flag kill-switch QA: sinkronisasi webhook ditunda saat diset. */
export const WEBHOOK_DISABLED_KEY = "webhook:midtrans:disabled";

/** Subset palet notifikasi HTTP Midtrans yang dipakai listener. */
export interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  transaction_id?: string;
  fraud_status?: string;
  payment_type?: string;
  [key: string]: unknown;
}

export type PaymentOutcome = "paid" | "expired" | "failed" | "pending";

function sha512Hex(input: string): string {
  return createHash("sha512").update(input).digest("hex");
}

/**
 * Verifikasi signature_key Midtrans: SHA512(order_id + status_code +
 * gross_amount + serverKey). Terima juga MIDTRANS_WEBHOOK_SECRET bila di-set
 * (klaim docs repo) — salah satunya cukup.
 */
export function verifyMidtransSignature(
  notification: Pick<
    MidtransNotification,
    "order_id" | "status_code" | "gross_amount" | "signature_key"
  >,
  serverKey: string,
  webhookSecret?: string,
): boolean {
  const { order_id, status_code, gross_amount, signature_key } = notification;
  if (!order_id || !status_code || !gross_amount || !signature_key) return false;

  const candidates = [serverKey, webhookSecret].filter(
    (k): k is string => !!k,
  );
  let provided: Buffer;
  try {
    provided = Buffer.from(signature_key, "hex");
  } catch {
    return false;
  }
  if (provided.length !== 64) return false;

  return candidates.some((key) => {
    const expected = Buffer.from(
      sha512Hex(`${order_id}${status_code}${gross_amount}${key}`),
      "hex",
    );
    return (
      expected.length === provided.length && timingSafeEqual(expected, provided)
    );
  });
}

/** Petakan transaction_status Midtrans ke outcome domuumen. */
export function resolvePaymentOutcome(
  notification: Pick<MidtransNotification, "transaction_status" | "fraud_status">,
): { outcome: PaymentOutcome } {
  const status = notification.transaction_status;
  if (status === "settlement") return { outcome: "paid" };
  if (status === "capture") {
    return { outcome: notification.fraud_status === "challenge" ? "pending" : "paid" };
  }
  if (status === "expire") return { outcome: "expired" };
  if (status === "cancel" || status === "deny" || status === "failure") {
    return { outcome: "failed" };
  }
  return { outcome: "pending" };
}
