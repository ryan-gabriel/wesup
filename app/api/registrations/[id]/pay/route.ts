import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";
import { acquireLock, releaseLock } from "@/app/api/_lib/distributed-lock";
import { apiLocked } from "@/app/api/_lib/response";

export const dynamic = "force-dynamic";

/**
 * POST /api/registrations/[id]/pay — Initiate QRIS payment for a registration.
 *
 * Creates a payment record. Midtrans integration is a stub — returns a
 * placeholder QR code URL until the Midtrans SDK is connected.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid registration id" }, { status: 400 });
  }

  const client = await getServerClient();

  let context;
  try {
    context = await requireRole(client as unknown as AuthClient, ["umkm"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  // Distributed lock to prevent double payment
  const lockToken = await acquireLock(`payment:${id}`, 30);
  if (!lockToken) {
    return apiLocked("Pembayaran sedang diproses. Mohon tunggu.");
  }

  try {
    // Fetch registration
    const { data: registration, error: regError } = await client
      .from("registrations")
      .select(
        "id, batch_id, umkm_id, quantity, status, final_amount, batches!inner(batch_timeline(payment_opens_at, payment_closes_at))",
      )
      .eq("id", id)
      .eq("umkm_id", context.userId)
      .single();

    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    if (registration.status !== "pending_payment") {
      return NextResponse.json(
        { error: `Registration status is '${registration.status}', expected 'pending_payment'` },
        { status: 400 },
      );
    }

    // Check payment window (lazy evaluation)
    const now = new Date();
    const batchData = Array.isArray(registration.batches)
      ? registration.batches[0]
      : registration.batches;
    const timeline = Array.isArray(batchData?.batch_timeline)
      ? batchData.batch_timeline[0]
      : batchData?.batch_timeline;

    if (timeline) {
      const payOpens = new Date(timeline.payment_opens_at);
      const payCloses = new Date(timeline.payment_closes_at);
      if (now < payOpens) {
        return NextResponse.json(
          { error: "Payment window has not opened yet" },
          { status: 400 },
        );
      }
      if (now > payCloses) {
        // Auto-expire: mark registration as cancelled
        await client
          .from("registrations")
          .update({ status: "cancelled" })
          .eq("id", id);
        return NextResponse.json(
          { error: "Payment window has closed" },
          { status: 400 },
        );
      }
    }

    const amount = registration.final_amount ?? 0;
    if (amount <= 0) {
      return NextResponse.json(
        { error: "Final amount has not been calculated yet" },
        { status: 400 },
      );
    }

    // Check for existing payment
    const { data: existingPayment } = await client
      .from("payments")
      .select("id, status")
      .eq("registration_id", id)
      .single();

    if (existingPayment) {
      return NextResponse.json(
        { error: `Payment already exists with status '${existingPayment.status}'` },
        { status: 409 },
      );
    }

    // Create payment record (Midtrans stub)
    const midtransOrderId = `WESUP-${id.substring(0, 8).toUpperCase()}-${Date.now()}`;
    const qrExpires = new Date(now.getTime() + 15 * 60 * 1000); // 15 min expiry

    const { data: payment, error: paymentError } = await client
      .from("payments")
      .insert({
        registration_id: id,
        midtrans_order_id: midtransOrderId,
        gross_amount: amount,
        status: "pending",
        qr_code_url: null, // Populated by Midtrans integration
        qr_code_expires_at: qrExpires.toISOString(),
      })
      .select("id, midtrans_order_id, gross_amount, status, qr_code_expires_at")
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Failed to create payment" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: payment,
        message:
          "Pembayaran berhasil dibuat. Silakan scan QR code untuk membayar.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Payment initiation failed:", error);
    return NextResponse.json(
      { error: "Failed to initiate payment" },
      { status: 500 },
    );
  } finally {
    await releaseLock(`payment:${id}`, lockToken);
  }
}
