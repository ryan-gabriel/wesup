import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireActive,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { parsePositiveInt } from "@/lib/admin/validation";
import type { RegistrationStatus } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * GET /api/registrations — List own registrations.
 *
 * UMKM sees their registrations; supplier sees registrations for their batches.
 * Query params: ?page=1&limit=20&status=registered&batch_id=
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parsePositiveInt(searchParams.get("page")) ?? 1;
  const limit = Math.min(parsePositiveInt(searchParams.get("limit")) ?? 20, 50);
  const statusFilter = searchParams.get("status")?.trim() ?? "";
  const batchIdFilter = searchParams.get("batch_id")?.trim() ?? "";
  const offset = (page - 1) * limit;

  const client = await getServerClient();

  let context;
  try {
    context = await requireActive(client as unknown as AuthClient);
  } catch (err) {
    return toAuthResponse(err);
  }

  let query = client
    .from("registrations")
    .select(
      "id, batch_id, umkm_id, quantity, status, locked_tier_number, locked_price_per_unit, final_amount, consented_at, created_at, updated_at, batches!inner(title, category, supplier_id, pickup_address)",
      { count: "exact" },
    )
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  // Role-based filtering
  if (context.role === "umkm") {
    query = query.eq("umkm_id", context.userId);
  } else if (context.role === "supplier") {
    query = query.eq("batches.supplier_id", context.userId);
  }
  // admin sees all

  if (statusFilter) {
    query = query.eq("status", statusFilter as RegistrationStatus);
  }
  if (batchIdFilter) {
    query = query.eq("batch_id", batchIdFilter);
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
