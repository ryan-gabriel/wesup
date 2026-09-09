import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import OrderCenterClient from "@/components/orders/OrderCenterClient";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pesanan | Wesup",
  description: "Kelola pesanan Anda di Wesup.",
};

export default async function PesananPage() {
  const viewer = await getCurrentUser((await getServerClient()) as unknown as AuthClient);
  if (!viewer) {
    redirect("/login");
  }

  return (
    <Layout>
      <PageContainer>
        <PageHeader
          title="Pesanan"
          description="Status, pembayaran, dan serah terima dari semua batch yang Anda ikuti."
          icon={<ShoppingBag aria-hidden="true" className="w-6 h-6" />}
        />
        <OrderCenterClient viewerRole={viewer.role} />
      </PageContainer>
    </Layout>
  );
}