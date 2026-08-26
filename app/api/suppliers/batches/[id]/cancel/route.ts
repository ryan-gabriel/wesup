import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (!body || typeof body.reason !== "string" || body.reason.trim() === "") {
    return NextResponse.json(
      { error: "Cancellation reason is required" },
      { status: 400 },
    );
  }

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["supplier"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { error } = await client.rpc("cancel_batch", {
    p_batch_id: id,
    p_reason: body.reason.trim(),
    p_ip_address: req.headers.get("x-forwarded-for"),
    p_user_agent: req.headers.get("user-agent"),
  });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
