import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import {
  requireActive,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/[id]/read — Mark a notification as read.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
  }

  const client = await getServerClient();

  let context;
  try {
    context = await requireActive(client as unknown as AuthClient);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", context.userId)
    .is("read_at", null); // Only update if unread

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
