import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";
import { adjustVolumeCounter } from "@/lib/orders/registration-counter";

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
    .select("id, batch_id, umkm_id, status, quantity")
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

  // Release the reserved quantity (skema main: batch:{id}:count)
  await adjustVolumeCounter(registration.batch_id, -registration.quantity);

  return NextResponse.json({
    success: true,
    message: "Registrasi berhasil dibatalkan.",
  });
}
