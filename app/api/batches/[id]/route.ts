import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";
import { triggerLazyCutoff } from "@/lib/batches/cutoff-runner";

export const dynamic = "force-dynamic";

/**
 * GET /api/batches/[id] — Batch detail with tiers, timeline, and registration count.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const client = await getServerClient();

  const { data: batch, error } = await client
    .from("batches")
    .select(
      "id, supplier_id, title, description, category, min_quantity, product_photo_url, pickup_address, latitude, longitude, status, created_at, updated_at, batch_tiers(id, tier_number, min_volume, max_volume, price_per_unit), batch_timeline(registration_opens_at, registration_closes_at, payment_opens_at, payment_closes_at, estimated_ready_at), profiles!inner(full_name, phone), supplier_profiles!inner(business_name, business_photo_url)",
    )
    .eq("id", id)
    .single();

  if (error || !batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  // Lazy cutoff: pembaca pertama pasca-tutup memicu penguncian harga
  const detailTimeline = Array.isArray(batch.batch_timeline)
    ? batch.batch_timeline[0]
    : batch.batch_timeline;
  if (
    batch.status === "published" &&
    detailTimeline &&
    Date.now() > Date.parse(detailTimeline.registration_closes_at)
  ) {
    const cutoff = await triggerLazyCutoff(client, id, Date.now());
    if (cutoff?.applied) batch.status = "closed";
  }

  // Get current registration count
  const { data: counter } = await client
    .from("registration_counters")
    .select("current_count")
    .eq("batch_id", id)
    .single();

  return NextResponse.json({
    data: {
      ...batch,
      registration_count: counter?.current_count ?? 0,
    },
  });
}
