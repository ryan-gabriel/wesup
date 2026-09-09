import { NextResponse } from "next/server";
import { requireRole, toAuthResponse, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { parseJsonBody, isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ registrationId: string }> },
) {
  const { registrationId } = await params;
  if (!isUuid(registrationId)) {
    return NextResponse.json({ error: "Invalid registration id" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const method = String(body.method ?? "").toLowerCase();
  if (method !== "qr" && method !== "pin") {
    return NextResponse.json({ error: "method must be qr or pin" }, { status: 400 });
  }
  if (typeof body.code !== "string" || body.code.trim() === "") {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["umkm", "supplier", "admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { error } = await client.rpc("confirm_pickup", {
    p_registration_id: registrationId,
    p_method: method,
    p_code: body.code.trim(),
    p_latitude: body.latitude !== undefined ? Number(body.latitude) : null,
    p_longitude: body.longitude !== undefined ? Number(body.longitude) : null,
    p_notes: typeof body.notes === "string" ? body.notes : null,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });

  if (error) {
    const msg = error.message ?? "";
    if (/invalid or already-used (qr code|pin)|not eligible|already picked up/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (/only the owning supplier|sign in required/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
