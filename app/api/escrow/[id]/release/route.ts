import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireActive,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";
import { acquireLock, releaseLock } from "@/app/api/_lib/distributed-lock";
import { apiLocked } from "@/app/api/_lib/response";

export const dynamic = "force-dynamic";

/**
 * POST /api/escrow/[id]/release — Release escrow funds to supplier.
 *
 * 🔒 CRITICAL — Uses distributed lock to prevent double-release
 * (double-click, admin + UMKM simultaneous, cron + manual).
 *
 * Authorized: UMKM who registered, or admin.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: escrowId } = await params;
  if (!isUuid(escrowId)) {
    return NextResponse.json({ error: "Invalid escrow id" }, { status: 400 });
  }

  const client = await getServerClient();

  let context;
  try {
    context = await requireActive(client as unknown as AuthClient);
  } catch (err) {
    return toAuthResponse(err);
  }

  // ──[1] ACQUIRE LOCK ────────────────────────────────────
  const lockToken = await acquireLock(`escrow_release:${escrowId}`, 60);
  if (!lockToken) {
    return apiLocked("Release sedang diproses. Mohon tunggu.");
  }

  try {
    // ──[2] VALIDATE ESCROW STATUS ────────────────────────
    const { data: escrow, error: escrowError } = await client
      .from("escrow_holds")
      .select(
        "id, registration_id, amount, status, auto_release_at, registrations!inner(umkm_id, batch_id, status, batches!inner(supplier_id))",
      )
      .eq("id", escrowId)
      .single();

    if (escrowError || !escrow) {
      return NextResponse.json({ error: "Escrow not found" }, { status: 404 });
    }

    // Authorization
    const regData = Array.isArray(escrow.registrations)
      ? escrow.registrations[0]
      : escrow.registrations;
    const batchData = regData
      ? Array.isArray(regData.batches)
        ? regData.batches[0]
        : regData.batches
      : null;

    const isUmkmOwner = regData?.umkm_id === context.userId;
    const isAdmin = context.role === "admin";

    if (!isUmkmOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Status checks
    if (escrow.status !== "held") {
      return NextResponse.json(
        { error: `Escrow already ${escrow.status}` },
        { status: 400 },
      );
    }

    if (regData?.status !== "picked_up") {
      return NextResponse.json(
        { error: "Registration must be in 'picked_up' status before release" },
        { status: 400 },
      );
    }

    const now = new Date();

    // ──[3] RELEASE ESCROW ────────────────────────────────
    // Update escrow status
    const { error: releaseError } = await client
      .from("escrow_holds")
      .update({
        status: "released",
        released_at: now.toISOString(),
        release_destination: "supplier",
      })
      .eq("id", escrowId)
      .eq("status", "held"); // Optimistic concurrency check

    if (releaseError) {
      return NextResponse.json(
        { error: "Failed to release escrow" },
        { status: 500 },
      );
    }

    // Update registration status to completed
    await client
      .from("registrations")
      .update({ status: "completed" })
      .eq("id", escrow.registration_id);

    return NextResponse.json({
      success: true,
      data: {
        escrow_id: escrowId,
        released_amount: escrow.amount,
        released_at: now.toISOString(),
        supplier_id: batchData?.supplier_id ?? null,
      },
      message: "Dana escrow berhasil dicairkan ke supplier.",
    });
  } catch (error) {
    console.error("Escrow release failed:", error);
    return NextResponse.json(
      { error: "Failed to release escrow" },
      { status: 500 },
    );
  } finally {
    // ──[4] RELEASE LOCK ──────────────────────────────────
    await releaseLock(`escrow_release:${escrowId}`, lockToken);
  }
}
