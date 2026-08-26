import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "reset-password");
  if (limited) return limited;

  const client = await getServerClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!code) {
    return NextResponse.json({ error: "Reset code is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.json({ error: "Invalid or expired reset code" }, { status: 400 });
  }

  const { error: updateError } = await client.auth.updateUser({ password });
  if (updateError) {
    await client.auth.signOut();
    return NextResponse.json({ error: "Invalid or expired reset code" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
