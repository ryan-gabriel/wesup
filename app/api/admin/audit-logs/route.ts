import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
  type AuthContext,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isUuid, parsePositiveInt } from "@/lib/admin/validation";
import type { AuditAction } from "@/types/database";

export const dynamic = "force-dynamic";

const AUDIT_ACTIONS = [
  "verify_supplier",
  "reject_supplier",
  "takedown_batch",
  "resolve_dispute",
  "approve_refund",
  "complete_refund",
  "suspend_user",
  "ban_user",
  "unban_user",
] as const satisfies readonly AuditAction[];

interface AuditLogsQuery {
  eq: (column: string, value: string) => AuditLogsQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => {
    range: (from: number, to: number) => PromiseLike<{
      data: unknown[] | null;
      error: Error | null;
    }>;
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const limit = limitParam === null ? 50 : parsePositiveInt(limitParam);
  const offset = offsetParam === null ? 0 : parsePositiveInt(offsetParam);
  if (limit === null || offset === null || limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: "limit must be an integer between 1 and 100" },
      { status: 400 },
    );
  }
  if (offset < 0) {
    return NextResponse.json(
      { error: "offset must be a non-negative integer" },
      { status: 400 },
    );
  }

  const actionType = url.searchParams.get("action_type");
  if (
    actionType !== null &&
    !(AUDIT_ACTIONS as readonly string[]).includes(actionType)
  ) {
    return NextResponse.json({ error: "invalid action_type" }, { status: 400 });
  }

  const adminId = url.searchParams.get("admin_id");
  if (adminId !== null && !isUuid(adminId)) {
    return NextResponse.json({ error: "invalid admin_id" }, { status: 400 });
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

  let query = client
    .from("admin_audit_logs")
    .select("*") as unknown as AuditLogsQuery;
  if (actionType) {
    query = query.eq("action_type", actionType);
  }
  if (adminId) {
    query = query.eq("admin_id", adminId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}