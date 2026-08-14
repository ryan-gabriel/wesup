import { NextResponse } from "next/server";
import {
  requireRole,
  toAuthResponse,
  type AuthClient,
} from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { isUuid, parseJsonBody } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

const WINNERS = ["supplier", "umkm"] as const;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid dispute id" }, { status: 400 });
  }

  const body = await parseJsonBody(req);
  if (
    !body ||
    typeof body.winner !== "string" ||
    !WINNERS.includes(body.winner as (typeof WINNERS)[number])
  ) {
    return NextResponse.json(
      { error: "winner must be supplier or umkm" },
      { status: 400 },
    );
  }
  const notes = body.notes === undefined ? null : body.notes;
  if (notes !== null && typeof notes !== "string") {
    return NextResponse.json(
      { error: "notes must be a string" },
      { status: 400 },
    );
  }

  const client = await getServerClient();
  try {
    await requireRole(client as unknown as AuthClient, ["admin"]);
  } catch (err) {
    return toAuthResponse(err);
  }

  const { error } = await client.rpc("resolve_dispute", {
    p_dispute_id: id,
    p_winner: body.winner,
    p_notes: notes,
    p_ip_address: req.headers.get("x-forwarded-for") ?? null,
    p_user_agent: req.headers.get("user-agent") ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}