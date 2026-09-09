import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { redis } from "@/lib/redis";
import { acquireLock, releaseLock } from "@/app/api/_lib/distributed-lock";
import {
  resolvePaymentOutcome,
  verifyMidtransSignature,
  WEBHOOK_DISABLED_KEY,
  type MidtransNotification,
} from "@/lib/payments/midtrans";

export const dynamic = "force-dynamic";

interface WebhookPayment {
  id: string;
  registration_id: string;
  status: string;
  gross_amount: number | string;
}

function error(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

/**
 * POST /api/webhook/midtrans — Midtrans HTTP notification listener.
 *
 * Tanpa sesi user; signature SHA512 adalah auth-nya. Idempoten (lock per
 * order + guard status), append-only log, cross-check nominal.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return error("Invalid JSON body", 400);
  }

  const notification = body as MidtransNotification;
  const { order_id, status_code, gross_amount, signature_key, transaction_status } =
    notification;
  if (
    typeof order_id !== "string" ||
    typeof status_code !== "string" ||
    typeof gross_amount !== "string" ||
    typeof signature_key !== "string" ||
    typeof transaction_status !== "string" ||
    !order_id
  ) {
    return error("Missing required Midtrans fields", 400);
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return error("Webhook not configured", 500);
  }
  if (
    !verifyMidtransSignature(
      { order_id, status_code, gross_amount, signature_key },
      serverKey,
      process.env.MIDTRANS_WEBHOOK_SECRET,
    )
  ) {
    return error("Invalid signature", 401);
  }

  // QA kill-switch (staging/dev): tunda sinkronisasi, jangan mutasi
  if (await redis.get(WEBHOOK_DISABLED_KEY)) {
    const client = getAdminClient();
    const { data: deferred } = await client
      .from("payments")
      .select("id")
      .eq("midtrans_order_id", order_id)
      .single();
    const row = deferred as { id: string } | null;
    if (row) {
      await client.from("payment_webhook_logs").insert({
        payment_id: row.id,
        event_type: transaction_status,
        payload: body as Record<string, never>,
        status: "deferred",
      });
    }
    return NextResponse.json(
      { success: true, data: { deferred: true } },
      { status: 202 },
    );
  }

  const lockToken = await acquireLock(`payment_webhook:${order_id}`, 60);
  if (!lockToken) {
    return error("Payment sedang diproses. Coba lagi.", 409);
  }

  try {
    const client = getAdminClient();
    const { data, error: findError } = await client
      .from("payments")
      .select("id, registration_id, status, gross_amount")
      .eq("midtrans_order_id", order_id)
      .single();

    if (findError || !data) {
      return error("Payment not found", 404);
    }
    const payment = data as unknown as WebhookPayment;

    // Anti-tampering: nominal callback harus sama dengan invoice terkunci
    const claimed = Number(gross_amount);
    if (!Number.isFinite(claimed) || claimed !== Number(payment.gross_amount)) {
      await client.from("payment_webhook_logs").insert({
        payment_id: payment.id,
        event_type: transaction_status,
        payload: body as Record<string, never>,
        status: "rejected",
        error_message: `Amount mismatch: callback ${gross_amount} vs invoice ${payment.gross_amount}`,
      });
      return error("Amount mismatch", 400);
    }

    const { error: logError } = await client.from("payment_webhook_logs").insert({
      payment_id: payment.id,
      event_type: transaction_status,
      payload: body as Record<string, never>,
      status: "processed",
    });
    if (logError) {
      return error("Failed to record webhook", 500);
    }

    const { outcome } = resolvePaymentOutcome(notification);
    if (outcome === "pending") {
      return NextResponse.json({ success: true, data: { status: "pending" } });
    }
    if (outcome === "paid" && payment.status === "paid") {
      return NextResponse.json({
        success: true,
        data: { status: "paid", duplicate: true },
      });
    }

    const now = new Date().toISOString();
    const paymentStatus = outcome === "paid" ? "paid" : outcome;
    const { error: paymentError } = await client
      .from("payments")
      .update({
        status: paymentStatus,
        paid_at: outcome === "paid" ? now : null,
        midtrans_transaction_id:
          typeof notification.transaction_id === "string"
            ? notification.transaction_id
            : null,
        webhook_payload: body as Record<string, never>,
        reconciled_at: now,
      })
      .eq("id", payment.id);
    if (paymentError) {
      return error("Failed to update payment", 500);
    }

    const { error: regError } = await client
      .from("registrations")
      .update({ status: outcome === "paid" ? "paid" : "cancelled" })
      .eq("id", payment.registration_id);
    if (regError) {
      return error("Failed to update registration", 500);
    }

    return NextResponse.json({
      success: true,
      data: { status: paymentStatus },
    });
  } finally {
    await releaseLock(`payment_webhook:${order_id}`, lockToken);
  }
}
