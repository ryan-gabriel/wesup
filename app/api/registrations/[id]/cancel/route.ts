import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * POST /api/registrations/[id]/cancel — Cancel a registration.
 *
 * Only the UMKM who registered can cancel, and only while status is
 * 'registered' (before payment). Restores the Redis counter.
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

  // Fetch registration
  const { data: registration, error: regError } = await client
    .from("registrations")
    .select("id, batch_id, umkm_id, status")
    .eq("id", id)
    .eq("umkm_id", context.userId)
    .single();

  if (regError || !registration) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Only allow cancel from 'registered' status
  if (registration.status !== "registered") {
    return NextResponse.json(
      { error: `Cannot cancel registration with status '${registration.status}'` },
      { status: 400 },
    );
  }

  // Update status to cancelled
  const { error: updateError } = await client
    .from("registrations")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to cancel registration" },
      { status: 500 },
    );
  }

  // Decrement Redis counter
  const counterKey = `batch_counter:${registration.batch_id}`;
  const newCount = await redis.decr(counterKey);

  // Sync counter to persistent table
  await client
    .from("registration_counters")
    .upsert(
      { batch_id: registration.batch_id, current_count: Math.max(0, newCount) },
      { onConflict: "batch_id" },
    );

  return NextResponse.json({
    success: true,
    message: "Registrasi berhasil dibatalkan.",
  });
}
