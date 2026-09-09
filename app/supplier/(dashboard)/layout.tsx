import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { requireRole, AuthError, type AuthClient } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function SupplierDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const client = await getServerClient();

  try {
    await requireRole(client as unknown as AuthClient, ["supplier"]);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) {
      redirect("/login");
    }
    redirect("/");
  }

  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
