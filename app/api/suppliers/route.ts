import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { parsePositiveInt } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/suppliers — List approved suppliers (public, no auth).
 *
 * Query params:
 *   ?page=1&limit=20&search=keyword
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parsePositiveInt(searchParams.get("page")) ?? 1;
  const limit = Math.min(parsePositiveInt(searchParams.get("limit")) ?? 20, 50);
  const search = searchParams.get("search")?.trim() ?? "";
  const offset = (page - 1) * limit;

  const client = await getServerClient();

  let query = client
    .from("supplier_profiles")
    .select(
      "user_id, business_name, address, latitude, longitude, business_photo_url, verification_status, profiles!inner(full_name, phone)",
      { count: "exact" },
    )
    .eq("verification_status", "approved")
    .range(offset, offset + limit - 1)
    .order("business_name", { ascending: true });

  if (search) {
    query = query.ilike("business_name", `%${search}%`);
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
