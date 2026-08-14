import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const client = await getServerClient();
  await client.auth.signOut();
  return NextResponse.json({ ok: true });
}
