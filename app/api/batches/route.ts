import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { parsePositiveInt } from "@/lib/admin/validation";
import { parseBatchTimeline } from "@/lib/batches/timeline";

export const dynamic = "force-dynamic";

/**
 * GET /api/batches — List published batches (public).
 *
 * Query params: ?page=1&limit=20&category=&search=&supplier_id=
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parsePositiveInt(searchParams.get("page")) ?? 1;
  const limit = Math.min(parsePositiveInt(searchParams.get("limit")) ?? 20, 50);
  const category = searchParams.get("category")?.trim() ?? "";
  const search = searchParams.get("search")?.trim() ?? "";
  const supplierId = searchParams.get("supplier_id")?.trim() ?? "";
  const offset = (page - 1) * limit;

  const client = await getServerClient();

  let query = client
    .from("batches")
    .select(
      "id, supplier_id, title, description, category, min_quantity, product_photo_url, pickup_address, latitude, longitude, status, created_at, batch_tiers(id, tier_number, min_volume, max_volume, price_per_unit), batch_timeline(registration_opens_at, registration_closes_at, payment_opens_at, payment_closes_at, estimated_ready_at), profiles!inner(full_name)",
      { count: "exact" },
    )
    .eq("status", "published")
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }
  if (search) {
    query = query.ilike("title", `%${search}%`);
  }
  if (supplierId) {
    query = query.eq("supplier_id", supplierId);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    data,
    meta: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  });
}

/**
 * POST /api/batches — Create a new batch (auth: verified supplier).
 *
 * Body: { title, description?, category, min_quantity, pickup_address,
 *         latitude, longitude, tiers: [...], timeline: {...} }
 */
export async function POST(request: NextRequest) {
  const client = await getServerClient();

  let context;
  try {
    context = await requireRole(client as unknown as AuthClient, ["supplier"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  // Ensure supplier is verified
  const { data: supplierProfile } = await client
    .from("supplier_profiles")
    .select("verification_status")
    .eq("user_id", context.userId)
    .single();

  if (!supplierProfile || supplierProfile.verification_status !== "approved") {
    return NextResponse.json(
      { error: "Supplier must be verified to create batches" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const minQuantity =
    typeof body.min_quantity === "number" ? body.min_quantity : 0;
  const pickupAddress =
    typeof body.pickup_address === "string" ? body.pickup_address.trim() : "";
  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;

  // Validate required fields
  if (!title || !category || minQuantity < 1 || !pickupAddress || latitude === null || longitude === null) {
    return NextResponse.json(
      { error: "Missing required fields: title, category, min_quantity, pickup_address, latitude, longitude" },
      { status: 400 },
    );
  }

  // Validate tiers
  const tiers = Array.isArray(body.tiers) ? body.tiers : [];
  if (tiers.length === 0) {
    return NextResponse.json(
      { error: "At least one pricing tier is required" },
      { status: 400 },
    );
  }

  // PRD Time-Travel Validation: absolute timestamps, strictly increasing
  // Buka < Tutup < Mulai Payment < Batas Akhir Payment < Ready
  const timelineResult = parseBatchTimeline(body.timeline);
  if ("error" in timelineResult) {
    return NextResponse.json({ error: timelineResult.error }, { status: 400 });
  }
  const timeline = timelineResult.data;

  // Insert batch
  const { data: batch, error: batchError } = await client
    .from("batches")
    .insert({
      supplier_id: context.userId,
      title,
      description,
      category,
      min_quantity: minQuantity,
      pickup_address: pickupAddress,
      latitude,
      longitude,
      status: "draft",
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: "Failed to create batch" }, { status: 500 });
  }

  // Insert tiers
  const tierInserts = tiers.map(
    (tier: Record<string, unknown>, index: number) => ({
      batch_id: batch.id,
      tier_number: index + 1,
      min_volume:
        typeof tier.min_volume === "number" ? tier.min_volume : 0,
      max_volume:
        typeof tier.max_volume === "number" ? tier.max_volume : null,
      price_per_unit:
        typeof tier.price_per_unit === "number" ? tier.price_per_unit : 0,
    }),
  );

  const { error: tiersError } = await client
    .from("batch_tiers")
    .insert(tierInserts);

  if (tiersError) {
    // Cleanup: delete the batch
    await client.from("batches").delete().eq("id", batch.id);
    return NextResponse.json(
      { error: "Failed to create pricing tiers" },
      { status: 500 },
    );
  }

  const { error: timelineError } = await client
    .from("batch_timeline")
    .insert({
      batch_id: batch.id,
      ...timeline,
    });

  if (timelineError) {
    // Cleanup
    await client.from("batch_tiers").delete().eq("batch_id", batch.id);
    await client.from("batches").delete().eq("id", batch.id);
    return NextResponse.json(
      { error: "Failed to create timeline" },
      { status: 500 },
    );
  }

  // Initialize registration counter
  await client
    .from("registration_counters")
    .insert({ batch_id: batch.id, current_count: 0 });

  return NextResponse.json({ data: { id: batch.id } }, { status: 201 });
}
