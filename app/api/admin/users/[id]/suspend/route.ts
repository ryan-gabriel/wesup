import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
  type AuthContext,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isIsoTimestamp, isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (
    !body ||
    typeof body.suspended_until !== "string" ||
    !isIsoTimestamp(body.suspended_until)
  ) {
    return NextResponse.json(
      { error: "suspended_until must be a valid ISO timestamp" },
      { status: 400 },
    );
  }

  const client = await getServerClient();
  let authCtx: AuthContext;
  try {
    authCtx = await requireRole(client as unknown as AuthClient, ["admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const limited = await enforceRateLimit(req, "admin", authCtx.userId);
  if (limited) return limited;

  const { error } = await client.rpc("suspend_user", {
    p_user_id: id,
    p_suspended_until: body.suspended_until,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}