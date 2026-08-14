import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await getServerClient();

  const context = await getCurrentUser(client as unknown as AuthClient);

  if (!context) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  if (context.status !== "active") {
    return NextResponse.json(
      { error: `Account is ${context.status}`, reason: context.status },
      { status: 403 },
    );
  }

  return NextResponse.json({
    user: { email: context.email },
    profile: {
      role: context.role,
      status: context.status,
      full_name: context.fullName,
    },
  });
}
