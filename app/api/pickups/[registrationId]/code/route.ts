import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ registrationId: string }> },
) {
  const { registrationId } = await params;
  if (!isUuid(registrationId)) {
    return NextResponse.json({ error: "Invalid registration id" }, { status: 400 });
  }

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["umkm", "supplier", "admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { data, error } = await client.rpc("generate_pickup_code", {
    p_registration_id: registrationId,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/sign in required|only the UMKM owner/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (/only available after payment/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const first = Array.isArray(data) ? data[0] : null;
  if (!first) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    qrCodeToken: first.qr_code_token,
    pinCode: first.pin_code,
  });
}
