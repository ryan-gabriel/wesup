import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AuthError, requireActive, type AuthClient } from "@/lib/supabase/auth";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AkunLayout({
  children,
}: {
  children: ReactNode;
}) {
  const client = await getServerClient();

  try {
    await requireActive(client as unknown as AuthClient);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) {
      redirect("/login");
    }
    redirect("/");
  }

  return <>{children}</>;
}