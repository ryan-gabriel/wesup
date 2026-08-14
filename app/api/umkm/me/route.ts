import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/umkm/me — Authenticated UMKM's own profile.
 */
export async function GET() {
  const client = await getServerClient();

  let context;
  try {
    context = await requireRole(client as unknown as AuthClient, ["umkm"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { data: profile, error } = await client
    .from("umkm_profiles")
    .select(
      "user_id, business_name, address, latitude, longitude, strike_count, suspended_until, created_at, updated_at",
    )
    .eq("user_id", context.userId)
    .single();

  if (error || !profile) {
    return NextResponse.json(
      { error: "UMKM profile not found" },
      { status: 404 },
    );
  }

  const { data: bankAccounts } = await client
    .from("umkm_bank_accounts")
    .select("id, bank_name, account_number, account_holder_name")
    .eq("umkm_id", context.userId);

  return NextResponse.json({
    user: { email: context.email, full_name: context.fullName },
    profile,
    bank_accounts: bankAccounts ?? [],
  });
}
