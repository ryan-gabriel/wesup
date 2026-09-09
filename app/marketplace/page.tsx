import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import { Store } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import MarketplaceClient from "@/components/marketplace/MarketplaceClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marketplace | Wesup",
  description: "Temukan penawaran produk UMKM dengan diskon berjenjang dari supplier terpercaya di sekitar Bandung.",
};

export default function MarketplacePage() {
  return (
    <Layout>
      <PageContainer>
        <PageHeader
          title="Marketplace"
          description="Temukan penawaran produk UMKM dengan diskon berjenjang dari supplier terpercaya."
          icon={<Store aria-hidden="true" className="w-6 h-6" />}
        />
        <MarketplaceClient />
      </PageContainer>
    </Layout>
  );
}
