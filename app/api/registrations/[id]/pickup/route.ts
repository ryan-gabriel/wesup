import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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
 * POST /api/registrations/[id]/pickup — Supplier confirms pickup.
 *
 * Validates pickup code (QR token or PIN), creates pickup event,
 * and initiates 24h escrow hold.
 *
 * Body: { method: "qr" | "pin", code: string, latitude?, longitude?, notes? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid registration id" }, { status: 400 });
  }

  const client = await getServerClient();

  let context;
  try {
    context = await requireRole(client as unknown as AuthClient, ["supplier"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const method = body.method === "qr" || body.method === "pin" ? body.method : null;
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!method || !code) {
    return NextResponse.json(
      { error: "method (qr|pin) and code are required" },
      { status: 400 },
    );
  }

  // Distributed lock to prevent double pickup
  const lockToken = await acquireLock(`pickup:${id}`, 30);
  if (!lockToken) {
    return apiLocked("Pickup sedang diproses. Mohon tunggu.");
  }

  try {
    // Fetch registration and verify supplier ownership
    const { data: registration, error: regError } = await client
      .from("registrations")
      .select(
        "id, batch_id, umkm_id, status, final_amount, batches!inner(supplier_id)",
      )
      .eq("id", id)
      .single();

    if (regError || !registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const batchData = Array.isArray(registration.batches)
      ? registration.batches[0]
      : registration.batches;

    if (batchData?.supplier_id !== context.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (registration.status !== "paid") {
      return NextResponse.json(
        { error: `Registration status must be 'paid', got '${registration.status}'` },
        { status: 400 },
      );
    }

    // Validate pickup code
    const { data: pickupCode, error: codeError } = await client
      .from("pickup_codes")
      .select("id, qr_code_token, pin_code, used_at")
      .eq("registration_id", id)
      .single();

    if (codeError || !pickupCode) {
      return NextResponse.json(
        { error: "Pickup code not found for this registration" },
        { status: 404 },
      );
    }

    if (pickupCode.used_at) {
      return NextResponse.json(
        { error: "Pickup code has already been used" },
        { status: 400 },
      );
    }

    // Verify the code matches
    const codeValid =
      (method === "qr" && pickupCode.qr_code_token === code) ||
      (method === "pin" && pickupCode.pin_code === code);

    if (!codeValid) {
      return NextResponse.json({ error: "Invalid pickup code" }, { status: 400 });
    }

    const now = new Date();

    // Mark pickup code as used
    await client
      .from("pickup_codes")
      .update({
        used_at: now.toISOString(),
        used_by_supplier_id: context.userId,
      })
      .eq("id", pickupCode.id);

    // Create pickup event
    await client.from("pickup_events").insert({
      registration_id: id,
      supplier_id: context.userId,
      method,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    // Update registration status
    await client
      .from("registrations")
      .update({ status: "picked_up" })
      .eq("id", id);

    // Create 24h escrow hold
    const autoReleaseAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await client.from("escrow_holds").insert({
      registration_id: id,
      amount: registration.final_amount ?? 0,
      status: "held",
      pickup_confirmed_at: now.toISOString(),
      auto_release_at: autoReleaseAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        pickup_confirmed_at: now.toISOString(),
        auto_release_at: autoReleaseAt.toISOString(),
      },
      message:
        "Pickup berhasil dikonfirmasi. Escrow akan dirilis otomatis setelah 24 jam.",
    });
  } catch (error) {
    console.error("Pickup confirmation failed:", error);
    return NextResponse.json(
      { error: "Failed to confirm pickup" },
      { status: 500 },
    );
  } finally {
    await releaseLock(`pickup:${id}`, lockToken);
  }
}
