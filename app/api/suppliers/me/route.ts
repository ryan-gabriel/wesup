import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/suppliers/me — Authenticated supplier's own profile.
 */
export async function GET() {
  const client = await getServerClient();

  let context;
  try {
    context = await requireRole(client as unknown as AuthClient, ["supplier"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { data: profile, error } = await client
    .from("supplier_profiles")
    .select(
      "user_id, business_name, address, latitude, longitude, business_photo_url, ktp_photo_url, nik, verification_status, verification_notes, is_location_locked, created_at, updated_at",
    )
    .eq("user_id", context.userId)
    .single();

  if (error || !profile) {
    return NextResponse.json(
      { error: "Supplier profile not found" },
      { status: 404 },
    );
  }

  const { data: bankAccounts } = await client
    .from("supplier_bank_accounts")
    .select("id, bank_name, account_number, account_holder_name, is_primary")
    .eq("supplier_id", context.userId)
    .order("is_primary", { ascending: false });

  return NextResponse.json({
    user: { email: context.email, full_name: context.fullName },
    profile,
    bank_accounts: bankAccounts ?? [],
  });
}
