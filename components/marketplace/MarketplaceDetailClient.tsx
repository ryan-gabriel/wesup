"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogIn, MapPin, Clock, Share2 } from "lucide-react";
import type { UserRole } from "@/types/database";
import type {
  MarketplaceItem,
  MarketplaceProgressResponse,
  MarketplaceTier,
  ViewerRegistration,
} from "@/lib/marketplace/types";
import { deriveTierProgress, hasTierDiscount } from "@/lib/marketplace/tier-progress";
import { buildWhatsAppShareUrl } from "@/lib/marketplace/share-link";
import MarketplaceRouteSection, { type MarketplaceRouteSummary } from "./MarketplaceRouteSection";
import LocationConsentCheckbox from "./LocationConsentCheckbox";
import SupplierRatingBadge from "./SupplierRatingBadge";
import TierProgressBar from "./TierProgressBar";
import JoinIntentQuantity from "./JoinIntentQuantity";
import JoinBatchForm from "./JoinBatchForm";
import { useTierProgress } from "@/hooks/use-tier-progress";
import { AppPanel } from "@/components/layout/AppPanel";
import { Eyebrow } from "@/components/landing/Eyebrow";
import MarketplaceUnavailable from "./MarketplaceUnavailable";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const closingTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatClosingTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Waktu tutup belum tersedia"
    : closingTimeFormatter.format(date);
}

function resolveInitialTiers(item: MarketplaceItem): MarketplaceTier[] {
  if (item.tiers && item.tiers.length > 0) return [...item.tiers];
  const target = Math.max(2, Math.trunc(item.targetQuantity));
  return [
    {
      tierNumber: 1,
      minVolume: 1,
      maxVolume: target - 1,
      pricePerUnit: item.currentTierPrice,
    },
    {
      tierNumber: 2,
      minVolume: target,
      maxVolume: null,
      pricePerUnit: item.currentTierPrice,
    },
  ];
}

function buildInitialProgress(item: MarketplaceItem): MarketplaceProgressResponse {
  const tiers = resolveInitialTiers(item);
  return {
    batchId: item.id,
    status: item.status === "ACTIVE" ? "published" : item.status.toLowerCase(),
    registeredQuantity: item.registeredQuantity,
    tiers,
    tierProgress: deriveTierProgress(tiers, item.registeredQuantity),
    registrationClosesAt: item.registrationClosesAt,
    serverTime: item.serverTime ?? "",
    registrationOpensAt: item.registrationOpensAt,
    availability: item.availability,
  };
}

export interface MarketplaceDetailClientProps {
  item: MarketplaceItem;
  canonicalUrl: string;
  /** Current viewers role from the server session; `null` when not signed in. */
  viewerRole: UserRole | null;
  /** Whether an authenticated UMKM has completed the required business profile. */
  viewerProfileComplete?: boolean;
  /** Whether this UMKM is using the temporary Bandung fallback. */
  needsProfileLocation?: boolean;
  /** The viewer's existing registration for this batch, when any. */
  viewerRegistration?: ViewerRegistration | null;
}

export default function MarketplaceDetailClient({
  item,
  canonicalUrl,
  viewerRole,
  viewerProfileComplete = true,
  needsProfileLocation = false,
  viewerRegistration = null,
}: MarketplaceDetailClientProps) {
  const [consentGiven, setConsentGiven] = useState(false);
  const [routeSummary, setRouteSummary] = useState<MarketplaceRouteSummary | null>(null);
  const initialProgress = useMemo(() => buildInitialProgress(item), [item]);
  const {
    progress: liveProgress,
    error: progressError,
    isRefreshing,
    applyRegistration,
    refresh,
  } = useTierProgress(item.id, initialProgress);

  const isUmkm = viewerRole === "umkm";
  const canJoinBatch = isUmkm && viewerProfileComplete;
  const viewerCanRoute = isUmkm && !needsProfileLocation;
  const handleRouteLoaded = useCallback((summary: MarketplaceRouteSummary) => {
    setRouteSummary(summary);
  }, []);
  const shareUrl = buildWhatsAppShareUrl(item, canonicalUrl);
  const liveTiers = liveProgress.tiers.length > 0 ? liveProgress.tiers : initialProgress.tiers;
  const currentPrice = liveProgress.tierProgress.currentPricePerUnit || item.currentTierPrice;
  const discounted = hasTierDiscount(item.basePrice, currentPrice, liveProgress.tierProgress.currentTierNumber);
  const displayDistanceKm = routeSummary?.distanceKm ?? item.distanceKm;
  const displayDurationMinutes = routeSummary?.durationMinutes ?? item.estimatedPickupMinutes;
  const distanceSourceLabel =
    routeSummary?.source === "straight_line_fallback"
      ? "Perkiraan garis lurus"
      : routeSummary
        ? "Rute berkendara"
        : "Jarak perkiraan";

  if (liveProgress.availability && !liveProgress.availability.canRegister) {
    return <MarketplaceUnavailable title={item.title} supplierName={item.supplierName} reason={liveProgress.availability.reason} />;
  }

  const liveItem = { ...item, availability: liveProgress.availability };
  return (
    <article className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <header className="app-enter">
          <Eyebrow>{item.category}</Eyebrow>
          <h1 className="mt-5 break-words font-landing-display text-3xl font-normal uppercase leading-[1.05] tracking-[0.04em] text-wesup-ink md:text-5xl">{item.title}</h1>
          <p className="mt-4 text-base text-wesup-ink-sub">{item.supplierName}</p>
          <div className="mt-2"><SupplierRatingBadge rating={item.supplierRating ?? null} /></div>
        </header>
        <AppPanel panelClassName="!p-0">
          <div className="relative aspect-[4/3] overflow-hidden bg-wesup-paper-sub sm:aspect-[16/10]">
            <Image src={item.imageUrl} alt={`Foto produk ${item.title}`} fill sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
          </div>
        </AppPanel>
      </div>

      <div className="min-w-0 lg:sticky lg:top-[var(--app-header-offset)] lg:row-span-2">
        <AppPanel>
          <div className="space-y-6 tabular-nums">
            <div>
              <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-wesup-ink-sub">Tier Diskon</p>
              <div className="mt-3 flex flex-wrap items-baseline gap-3">
                <span className="font-landing-display text-3xl tracking-tight text-wesup-ink">{rupiahFormatter.format(currentPrice)}</span>
                {discounted && <span className="text-sm text-wesup-ink-sub line-through">{rupiahFormatter.format(item.basePrice)}</span>}
              </div>
            </div>
            <TierProgressBar registeredQuantity={liveProgress.registeredQuantity} tiers={liveTiers} tierProgress={liveProgress.tierProgress} targetQuantity={item.targetQuantity} showPrice={false} />
            <p className="font-mono text-xs leading-6 text-wesup-ink-sub">Tutup pendaftaran: {formatClosingTime(liveProgress.registrationClosesAt)}{isRefreshing ? " • Memperbarui…" : ""}</p>
            {progressError && <p className="border-l-2 border-wesup-red pl-3 text-xs leading-6 text-wesup-ink-sub" role="status" aria-live="polite">Ketersediaan belum dapat diperiksa. Pendaftaran dinonaktifkan sampai pemeriksaan berhasil.</p>}
            {progressError && <button type="button" onClick={() => void refresh()} className="min-h-11 text-sm font-semibold underline underline-offset-4">Periksa lagi</button>}
            <dl className="divide-y divide-wesup-ink/15 border-y border-wesup-ink/15 text-sm">
              <div className="py-4"><dt className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em]"><MapPin aria-hidden="true" className="size-4" />Titik kumpul Supplier</dt><dd className="mt-2 leading-7 text-wesup-ink-sub">{item.pickupAddress}</dd></div>
              <div className="py-4"><dt className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em]"><Clock aria-hidden="true" className="size-4" />Estimasi &amp; Jarak</dt><dd className="mt-2 leading-7 text-wesup-ink-sub">{displayDistanceKm === null ? "Jarak belum tersedia" : `${routeSummary ? distanceSourceLabel + ": " : ""}${displayDistanceKm.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`}{" • "}{displayDurationMinutes === null ? "Estimasi belum tersedia" : `${displayDurationMinutes} mnt (${routeSummary?.source === "osrm" ? "Berkendara" : "Pickup"})`}</dd></div>
            </dl>
            {isUmkm && needsProfileLocation && <div className="border-l-2 border-wesup-red pl-4 text-sm leading-7" role="status" aria-live="polite"><p><strong>Lokasi usaha belum tersimpan.</strong> Jarak sementara dihitung dari pusat Bandung.</p><Link href={`/umkm/onboarding?returnTo=/marketplace/${encodeURIComponent(item.id)}`} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Simpan lokasi</Link></div>}
            {canJoinBatch && <LocationConsentCheckbox onChange={checked => setConsentGiven(checked)} />}
            <div className="app-purchase-dock sticky z-10 -mx-5 border-t border-wesup-ink/15 bg-wesup-paper px-5 py-4 sm:static sm:mx-0 sm:border-0 sm:p-0">
              {!canJoinBatch && item.policyVersion === 2 && <JoinIntentQuantity item={item} />}
              {canJoinBatch ? <JoinBatchForm item={liveItem} consentGiven={consentGiven} initialRegistration={viewerRegistration} availabilityBlocked={!!progressError || !liveProgress.availability} onAvailabilityCheck={refresh} onSuccess={({ count }) => applyRegistration(count)} /> : isUmkm ? <Link href={`/umkm/onboarding?returnTo=/marketplace/${encodeURIComponent(item.id)}`} className="inline-flex min-h-12 w-full items-center justify-center bg-wesup-ink px-4 py-3 text-sm font-semibold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red">Lengkapi profil untuk Mendaftar</Link> : viewerRole === null ? <Link href={`/login?role=umkm&returnTo=/marketplace/${encodeURIComponent(item.id)}`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-wesup-ink px-4 py-3 text-sm font-semibold text-wesup-paper transition-colors duration-500 wesup-ease hover:bg-wesup-red"><LogIn aria-hidden="true" className="size-4" />Masuk sebagai UMKM untuk Mendaftar</Link> : <p className="border border-wesup-ink/15 p-4 text-center text-sm leading-6">Pendaftaran hanya untuk akun UMKM.</p>}
            </div>
            <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 w-full items-center justify-center gap-2 border border-wesup-ink/20 px-4 py-3 text-sm font-semibold transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub"><Share2 aria-hidden="true" className="size-4" />Bagikan via WhatsApp</a>
          </div>
        </AppPanel>
      </div>

      <section className="min-w-0 lg:col-start-1" aria-label="Detail lokasi pickup">
        <AppPanel>
          <h2 className="mb-5 font-mono text-[0.6875rem] uppercase tracking-[0.2em]">Lokasi Titik Kumpul</h2>
          <MarketplaceRouteSection batchId={item.id} viewerCanRoute={viewerCanRoute} pickupLatitude={item.pickupLatitude} pickupLongitude={item.pickupLongitude} pickupAddress={item.pickupAddress} onRouteLoaded={handleRouteLoaded} />
        </AppPanel>
      </section>
    </article>
  );
}
