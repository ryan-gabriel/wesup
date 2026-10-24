import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MarketplaceDetailClient from "@/components/marketplace/MarketplaceDetailClient";
import { buildPublicMarketplaceUrl } from "@/lib/marketplace/share-link";
import { fetchMarketplaceDetail } from "@/lib/marketplace/server-repository";
import { getServerClient } from "@/lib/supabase/server";
import { getCurrentUser, type AuthClient } from "@/lib/supabase/auth";
import { resolveMarketplaceOrigin, type MarketplaceOriginClient } from "@/lib/marketplace/origin";
import { getViewerAccessState, type AccessStateClient } from "@/lib/auth/access-state";
import { isUuid } from "@/lib/admin/validation";
import type { ViewerRegistration } from "@/lib/marketplace/types";

export const dynamic = "force-dynamic";

async function readViewerRegistration(
  client: Awaited<ReturnType<typeof getServerClient>>,
  batchId: string,
  userId: string,
  canWithdraw: boolean,
): Promise<ViewerRegistration | null> {
  try {
    const { data, error } = await client
      .from("registrations")
      .select("id,quantity,status")
      .eq("batch_id", batchId)
      .eq("umkm_id", userId)
      .maybeSingle();
    if (error || !data || data.status === "cancelled") return null;
    return {
      registrationId: data.id,
      quantity: data.quantity,
      canWithdraw: canWithdraw && data.status === "registered",
    };
  } catch {
    return null;
  }
}

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
  const context = await getCurrentUser(client as unknown as AuthClient);
  const origin = await resolveMarketplaceOrigin(client as unknown as MarketplaceOriginClient, context);
  const item = await fetchMarketplaceDetail(client as never, id, { latitude: origin.latitude, longitude: origin.longitude });
  if (!item) notFound();

  const viewerAccess = await getViewerAccessState(client as unknown as AccessStateClient);
  const viewerRole = viewerAccess?.role ?? null;
  const viewerProfileComplete = viewerAccess?.role === "umkm" ? viewerAccess.profileComplete : undefined;
  const viewerRegistration =
    viewerAccess?.role === "umkm" && context
      ? await readViewerRegistration(
          client,
          id,
          context.userId,
          // ponytail: mirrors get_registration_volume_v2.canWithdraw from the page
          // snapshot; the withdraw endpoint remains the authority.
          item.policyVersion === 2 &&
            item.status === "ACTIVE" &&
            item.availability?.canRegister === true,
        )
      : null;
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredSiteUrl && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be configured for canonical marketplace links");
  }
  const canonicalUrl = buildPublicMarketplaceUrl(
    id,
    configuredSiteUrl ?? "http://localhost:3000",
  );

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-sm font-semibold text-wesup-ink-sub hover:text-wesup-ink transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          Kembali ke Marketplace
        </Link>
        <div className="mt-4">
          <MarketplaceDetailClient
            key={item.id}
            item={item}
            canonicalUrl={canonicalUrl}
            viewerRole={viewerRole}
            viewerProfileComplete={viewerProfileComplete}
            needsProfileLocation={origin.needsProfileLocation}
            viewerRegistration={viewerRegistration}
          />
        </div>
      </div>
    </>
  );
}
