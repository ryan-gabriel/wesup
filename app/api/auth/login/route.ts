import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAccountStatusMessage,
  getRoleMismatchMessage,
  LOGIN_REDIRECT_BY_ROLE,
  parseLoginPayload,
} from "@/lib/auth/login-contract";
import { getCurrentUser } from "@/lib/supabase/auth";
import type { AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, "login");
  if (limited) return limited;

  const client = await getServerClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseLoginPayload(body);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: "Periksa kembali data login Anda.",
        fieldErrors: parsed.fieldErrors,
      },
      { status: 400 },
    );
  }

  const { email, password, role: selectedRole } = parsed.value;
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json(
      { code: "invalid_credentials", error: "Email atau password salah." },
      { status: 401 },
    );
  }

  let context;
  try {
    context = await getCurrentUser(client as unknown as AuthClient);
  } catch {
    await client.auth.signOut();
    return NextResponse.json(
      {
        code: "profile_unavailable",
        error: "Profil akun belum dapat dimuat. Coba lagi.",
      },
      { status: 500 },
    );
  }

  if (!context) {
    await client.auth.signOut();
    return NextResponse.json(
      {
        code: "profile_unavailable",
        error: "Profil akun belum dapat dimuat. Coba lagi.",
      },
      { status: 500 },
    );
  }

  if (context.status !== "active") {
    const errorMessage = getAccountStatusMessage(context.status);
    await client.auth.signOut();
    return NextResponse.json(
      { code: "inactive_account", error: errorMessage },
      { status: 403 },
    );
  }

  if (context.role !== selectedRole) {
    let verificationStatus: "pending" | "approved" | "rejected" | null = null;

    if (selectedRole === "supplier") {
      const { data: supplierProfile } = await client
        .from("supplier_profiles")
        .select("verification_status")
        .eq("user_id", context.userId)
        .maybeSingle();
      verificationStatus = supplierProfile?.verification_status ?? null;
    }

    const errorMessage = getRoleMismatchMessage(selectedRole, verificationStatus);
    const code =
      selectedRole === "supplier" && verificationStatus === "pending"
        ? "supplier_pending"
        : selectedRole === "supplier" && verificationStatus === "rejected"
          ? "supplier_rejected"
          : "role_mismatch";

    await client.auth.signOut();
    return NextResponse.json(
      { code, error: errorMessage },
      { status: 403 },
    );
  }

  return NextResponse.json({
    user: { email: context.email },
    profile: {
      role: context.role,
      status: context.status,
      fullName: context.fullName,
    },
    redirectTo: LOGIN_REDIRECT_BY_ROLE[selectedRole],
  });
}
