import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/suppliers/[id] — Detail supplier (public for approved suppliers).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid supplier id" }, { status: 400 });
  }

  const client = await getServerClient();

  const { data, error } = await client
    .from("supplier_profiles")
    .select(
      "user_id, business_name, address, latitude, longitude, business_photo_url, verification_status, created_at, profiles!inner(full_name, phone)",
    )
    .eq("user_id", id)
    .eq("verification_status", "approved")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
