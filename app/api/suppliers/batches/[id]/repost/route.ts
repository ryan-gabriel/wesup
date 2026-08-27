import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";
import { shiftBatchTimeline } from "@/lib/batches/recurring";
import type { BatchTimeline } from "@/lib/batches/timeline";

export const dynamic = "force-dynamic";

interface RepostSourceTier {
  tier_number: number;
  min_volume: number;
  max_volume: number | null;
  price_per_unit: number;
}

interface RepostSource {
  supplier_id: string;
  title: string;
  description: string | null;
  category: string;
  min_quantity: number;
  pickup_address: string;
  latitude: number;
  longitude: number;
  batch_tiers: RepostSourceTier[];
  batch_timeline: BatchTimeline;
}

/**
 * POST /api/suppliers/batches/[id]/repost — recurring post (PRD Modul Catalog).
 * Copies a previous batch into a new DRAFT with every timeline parameter
 * shifted by interval_days (e.g. +7). Supplier reviews and publishes it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const intervalDays = body.interval_days;
  if (
    typeof intervalDays !== "number" ||
    !Number.isInteger(intervalDays) ||
    intervalDays <= 0
  ) {
    return NextResponse.json(
      { error: "interval_days must be a positive integer" },
      { status: 400 },
    );
  }

  const client = await getServerClient();
  let context;
  try {
    context = await requireRole(client as unknown as AuthClient, ["supplier"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  // ponytail: no recurring_configs bookkeeping yet — the shifted copy is the feature; wire the config table when auto-generation lands.
  const { data: source, error: sourceError } = await client
    .from("batches")
    .select(
      "supplier_id, title, description, category, min_quantity, pickup_address, latitude, longitude, batch_tiers(tier_number, min_volume, max_volume, price_per_unit), batch_timeline(registration_opens_at, registration_closes_at, payment_opens_at, payment_closes_at, estimated_ready_at)",
    )
    .eq("id", id)
    .eq("supplier_id", context.userId)
    .single();

  if (sourceError || !source) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const src = source as unknown as RepostSource;
  if (!src.batch_timeline) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const timeline = shiftBatchTimeline(src.batch_timeline, intervalDays);

  const { data: batch, error: batchError } = await client
    .from("batches")
    .insert({
      supplier_id: src.supplier_id,
      title: src.title,
      description: src.description,
      category: src.category,
      min_quantity: src.min_quantity,
      pickup_address: src.pickup_address,
      latitude: src.latitude,
      longitude: src.longitude,
      status: "draft",
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
  }

  const tierInserts = src.batch_tiers.map((tier) => ({
    batch_id: batch.id,
    tier_number: tier.tier_number,
    min_volume: tier.min_volume,
    max_volume: tier.max_volume,
    price_per_unit: tier.price_per_unit,
  }));

  const { error: tiersError } = await client
    .from("batch_tiers")
    .insert(tierInserts);

  if (tiersError) {
    await client.from("batches").delete().eq("id", batch.id);
    return NextResponse.json({ error: "Failed to create pricing tiers" }, { status: 500 });
  }

  const { error: timelineError } = await client
    .from("batch_timeline")
    .insert({
      batch_id: batch.id,
      ...timeline,
    });

  if (timelineError) {
    await client.from("batch_tiers").delete().eq("batch_id", batch.id);
    await client.from("batches").delete().eq("id", batch.id);
    return NextResponse.json({ error: "Failed to create timeline" }, { status: 500 });
  }

  await client
    .from("registration_counters")
    .insert({ batch_id: batch.id, current_count: 0 });

  return NextResponse.json({ data: { id: batch.id } }, { status: 201 });
}
