import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireActive,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { parsePositiveInt } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications — List notifications for authenticated user.
 *
 * Query params: ?page=1&limit=20&unread_only=true
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = parsePositiveInt(searchParams.get("page")) ?? 1;
  const limit = Math.min(parsePositiveInt(searchParams.get("limit")) ?? 20, 50);
  const unreadOnly = searchParams.get("unread_only") === "true";
  const offset = (page - 1) * limit;

  const client = await getServerClient();

  let context;
  try {
    context = await requireActive(client as unknown as AuthClient);
  } catch (err) {
    return toAuthResponse(err);
  }

  let query = client
    .from("notifications")
    .select("id, type, title, message, data, read_at, sent_via_whatsapp, whatsapp_status, created_at", {
      count: "exact",
    })
    .eq("user_id", context.userId)
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Count unread
  const { count: unreadCount } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .is("read_at", null);

  return NextResponse.json({
    data,
    meta: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
      unread_count: unreadCount ?? 0,
    },
  });
}
