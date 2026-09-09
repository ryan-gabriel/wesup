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
import { rateLimit } from "@/app/api/_lib/rate-limit";
import { apiRateLimit } from "@/app/api/_lib/response";
import { adjustVolumeCounter } from "@/lib/orders/registration-counter";

export const dynamic = "force-dynamic";

/**
 * POST /api/batches/[id]/register — UMKM registers to a batch.
 *
 * 🔒 CRITICAL PATH — uses distributed lock + Redis atomic counter
 * to prevent race conditions (two UMKMs registering when only 1 slot left).
 *
 * Body: { quantity, consent_latitude?, consent_longitude? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: batchId } = await params;
  if (!isUuid(batchId)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const client = await getServerClient();

  // ──[1] AUTH & RATE LIMITING ────────────────────────────
  let context;
  try {
    context = await requireRole(client as unknown as AuthClient, ["umkm"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const rate = await rateLimit(`register:${context.userId}`, 5, 60);
  if (!rate.allowed) {
    return apiRateLimit(rate.retryAfter ?? 60);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const quantity = typeof body.quantity === "number" ? body.quantity : 0;
  if (quantity < 1) {
    return NextResponse.json(
      { error: "Quantity must be at least 1" },
      { status: 400 },
    );
  }

  // ──[2] ACQUIRE DISTRIBUTED LOCK ────────────────────────
  const lockToken = await acquireLock(`batch_register:${batchId}`, 30);

  if (!lockToken) {
    return NextResponse.json(
      {
        status: "queued",
        message:
          "Batch sedang diproses pengguna lain. Mohon coba beberapa saat lagi.",
        retryAfter: 5,
      },
      { status: 202 },
    );
  }

  try {
    // ──[3] VALIDATE BATCH & TIMELINE ─────────────────────
    const { data: batch, error: batchError } = await client
      .from("batches")
      .select(
        "id, supplier_id, min_quantity, status, batch_timeline(registration_opens_at, registration_closes_at)",
      )
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    if (batch.status !== "published") {
      return NextResponse.json(
        { error: "Batch is not open for registration" },
        { status: 400 },
      );
    }

    // Check registration window (lazy evaluation — compute on-demand)
    const now = new Date();
    const timeline = Array.isArray(batch.batch_timeline)
      ? batch.batch_timeline[0]
      : batch.batch_timeline;

    if (timeline) {
      const opensAt = new Date(timeline.registration_opens_at);
      const closesAt = new Date(timeline.registration_closes_at);

      if (now < opensAt) {
        return NextResponse.json(
          { error: "Registration has not opened yet" },
          { status: 400 },
        );
      }
      if (now > closesAt) {
        return NextResponse.json(
          { error: "Registration window has closed" },
          { status: 400 },
        );
      }
    }

    if (quantity < batch.min_quantity) {
      return NextResponse.json(
        { error: `Minimum order quantity is ${batch.min_quantity}` },
        { status: 400 },
      );
    }

    // Check duplicate registration (unique(batch_id, umkm_id))
    const { data: existing } = await client
      .from("registrations")
      .select("id")
      .eq("batch_id", batchId)
      .eq("umkm_id", context.userId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Already registered for this batch" },
        { status: 409 },
      );
    }

    // Check UMKM suspension
    const { data: umkmProfile } = await client
      .from("umkm_profiles")
      .select("suspended_until")
      .eq("user_id", context.userId)
      .single();

    if (umkmProfile?.suspended_until && new Date(umkmProfile.suspended_until) > now) {
      return NextResponse.json(
        { error: "Account is suspended", suspended_until: umkmProfile.suspended_until },
        { status: 403 },
      );
    }

    // ──[4] REDIS ATOMIC COUNTER — reserve quantity (skema main:
    // batch:{id}:count; mirror DB eksklusif milik cut_off_batch)
    const newCount = await adjustVolumeCounter(batchId, quantity);

    // ──[5] CREATE REGISTRATION ───────────────────────────
    const { data: registration, error: regError } = await client
      .from("registrations")
      .insert({
        batch_id: batchId,
        umkm_id: context.userId,
        quantity,
        consented_at: now.toISOString(),
        consent_latitude:
          typeof body.consent_latitude === "number"
            ? body.consent_latitude
            : null,
        consent_longitude:
          typeof body.consent_longitude === "number"
            ? body.consent_longitude
            : null,
        status: "registered",
      })
      .select("id, created_at")
      .single();

    if (regError || !registration) {
      // Rollback counter on failure
      await adjustVolumeCounter(batchId, -quantity).catch(() => undefined);
      return NextResponse.json(
        { error: "Failed to create registration" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          registration_id: registration.id,
          batch_id: batchId,
          quantity,
          registration_count: newCount,
        },
        message: "Registrasi berhasil. Silakan tunggu periode pembayaran.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration failed:", error);
    return NextResponse.json(
      { error: "Failed to process registration. Please try again." },
      { status: 500 },
    );
  } finally {
    // ──[6] RELEASE LOCK ──────────────────────────────────
    await releaseLock(`batch_register:${batchId}`, lockToken);
  }
}
