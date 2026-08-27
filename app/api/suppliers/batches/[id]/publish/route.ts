import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["supplier"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { error } = await client.rpc("publish_batch", { p_batch_id: id });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
