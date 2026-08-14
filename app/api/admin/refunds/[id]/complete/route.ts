import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isHttpUrl, isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid refund id" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (
    !body ||
    typeof body.transfer_proof_url !== "string" ||
    body.transfer_proof_url.trim() === ""
  ) {
    return NextResponse.json(
      { error: "Transfer proof URL is required" },
      { status: 400 },
    );
  }
  if (!isHttpUrl(body.transfer_proof_url.trim())) {
    return NextResponse.json(
      { error: "Transfer proof URL must be a valid http(s) URL" },
      { status: 400 },
    );
  }

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { error } = await client.rpc("complete_refund", {
    p_refund_id: id,
    p_transfer_proof_url: body.transfer_proof_url.trim(),
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}