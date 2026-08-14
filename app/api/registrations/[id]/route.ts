import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireActive,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/registrations/[id] — Registration detail with payment, pickup, escrow.
 */
export async function GET(
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
    context = await requireActive(client as unknown as AuthClient);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { data: registration, error } = await client
    .from("registrations")
    .select(
      "id, batch_id, umkm_id, quantity, status, locked_tier_number, locked_price_per_unit, final_amount, consented_at, created_at, updated_at, batches!inner(title, category, supplier_id, pickup_address, latitude, longitude, status, profiles!inner(full_name)), payments(id, midtrans_order_id, gross_amount, status, qr_code_url, qr_code_expires_at, paid_at), pickup_codes(id, qr_code_token, pin_code, used_at), escrow_holds(id, amount, status, pickup_confirmed_at, auto_release_at, released_at, release_destination)",
    )
    .eq("id", id)
    .single();

  if (error || !registration) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Authorization: only the UMKM who registered, the batch supplier, or admin
  const isOwner = registration.umkm_id === context.userId;
  const batchData = Array.isArray(registration.batches)
    ? registration.batches[0]
    : registration.batches;
  const isSupplier = batchData?.supplier_id === context.userId;
  const isAdmin = context.role === "admin";

  if (!isOwner && !isSupplier && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: registration });
}
