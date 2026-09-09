import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import MarketplaceDetailClient from "@/components/marketplace/MarketplaceDetailClient";
import { buildPublicMarketplaceUrl } from "@/lib/marketplace/share-link";
import { fetchMarketplaceDetail } from "@/lib/marketplace/server-repository";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Detail Penawaran | Wesup",
  description: "Lihat detail penawaran produk UMKM di marketplace Wesup.",
};

export default async function MarketplaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const client = await getServerClient();
  const item = await fetchMarketplaceDetail(client as never, id);
  if (!item) notFound();

  const viewer = await getCurrentUser(client as unknown as AuthClient);
  const viewerRole = viewer?.role ?? null;
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredSiteUrl && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be configured for canonical marketplace links");
  }
  const canonicalUrl = buildPublicMarketplaceUrl(
    id,
    configuredSiteUrl ?? "http://localhost:3000",
  );

  return (
    <Layout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          Kembali ke Marketplace
        </Link>
        <div className="mt-4">
          <MarketplaceDetailClient
            item={item}
            canonicalUrl={canonicalUrl}
            viewerRole={viewerRole}
          />
        </div>
      </div>
    </Layout>
  );
}
