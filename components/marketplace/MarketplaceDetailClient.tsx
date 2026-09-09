"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogIn, MapPin, Clock, Tag, Share2 } from "lucide-react";
import type { UserRole } from "@/types/database";
import type {
  MarketplaceItem,
  MarketplaceProgressResponse,
  MarketplaceTier,
} from "@/lib/marketplace/types";
import { deriveTierProgress } from "@/lib/marketplace/tier-progress";
import { buildWhatsAppShareUrl } from "@/lib/marketplace/share-link";
import PickupLocationMapClient from "./PickupLocationMapClient";
import LocationConsentCheckbox from "./LocationConsentCheckbox";
import SupplierRatingBadge from "./SupplierRatingBadge";
import TierProgressBar from "./TierProgressBar";
import JoinBatchForm from "./JoinBatchForm";
import { useTierProgress } from "@/hooks/use-tier-progress";

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
    serverTime: new Date().toISOString(),
  };
}

export interface MarketplaceDetailClientProps {
  item: MarketplaceItem;
  canonicalUrl: string;
  /** Current viewer's role from the server session; `null` when not signed in. */
  viewerRole: UserRole | null;
}

export default function MarketplaceDetailClient({
  item,
  canonicalUrl,
  viewerRole,
}: MarketplaceDetailClientProps) {
  const [consentGiven, setConsentGiven] = useState(false);
  const initialProgress = useMemo(() => buildInitialProgress(item), [item]);
  const {
    progress: liveProgress,
    error: progressError,
    isRefreshing,
    applyRegistration,
  } = useTierProgress(item.id, initialProgress);

  const isUmkm = viewerRole === "umkm";
  const shareUrl = buildWhatsAppShareUrl(item, canonicalUrl);
  const liveTiers = liveProgress.tiers.length > 0 ? liveProgress.tiers : initialProgress.tiers;
  const currentPrice = liveProgress.tierProgress.currentPricePerUnit || item.currentTierPrice;

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="relative w-full aspect-[16/9] bg-slate-100">
        <Image
          src={item.imageUrl}
          alt={`Foto produk ${item.title}`}
          fill
          sizes="(min-width: 1024px) 768px, 100vw"
          className="object-cover"
        />
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-semibold text-blue-700 shadow-sm border border-white">
          {item.category}
        </div>
      </div>

      <div className="p-5 md:p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
            {item.title}
          </h1>
          <p className="mt-2 text-base font-medium text-slate-500">{item.supplierName}</p>
          <div className="mt-1.5">
            <SupplierRatingBadge rating={item.supplierRating ?? null} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <MapPin aria-hidden="true" className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Titik kumpul Supplier</p>
              <p className="text-sm text-slate-500">{item.pickupAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <Clock aria-hidden="true" className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Estimasi & Jarak</p>
              <p className="text-sm text-slate-500">
                {item.distanceKm === null
                  ? "Jarak belum tersedia"
                  : `${item.distanceKm.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`}
                {" • "}
                {item.estimatedPickupMinutes === null
                  ? "Estimasi belum tersedia"
                  : `${item.estimatedPickupMinutes} mnt (Pickup)`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <MapPin aria-hidden="true" className="w-4 h-4" />
            <span>Lokasi Titik Kumpul</span>
          </div>
          <PickupLocationMapClient
            latitude={item.pickupLatitude}
            longitude={item.pickupLongitude}
            address={item.pickupAddress}
          />
        </div>

        <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
            <Tag aria-hidden="true" className="w-4 h-4" />
            <span>Tier Diskon</span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              {rupiahFormatter.format(currentPrice)}
            </span>
            <span className="text-sm font-medium text-slate-400 line-through mb-1">
              {rupiahFormatter.format(item.basePrice)}
            </span>
          </div>
        </div>

        <TierProgressBar
          registeredQuantity={liveProgress.registeredQuantity}
          tiers={liveTiers}
          tierProgress={liveProgress.tierProgress}
          targetQuantity={item.targetQuantity}
          showPrice={false}
        />
        <p className="-mt-4 text-xs font-medium text-slate-500">
          Tutup pendaftaran: {formatClosingTime(liveProgress.registrationClosesAt)}
          {isRefreshing ? " • Memperbarui…" : ""}
        </p>
        {progressError ? (
          <p className="-mt-3 text-xs font-medium text-amber-700" role="status" aria-live="polite">
            Progress terakhir ditampilkan. Pembaruan berikutnya akan dicoba otomatis.
          </p>
        ) : null}

        {isUmkm ? (
          <LocationConsentCheckbox onChange={(checked) => setConsentGiven(checked)} />
        ) : null}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          {isUmkm ? (
            <div className="flex-1">
              <JoinBatchForm
                item={item}
                consentGiven={consentGiven}
                onSuccess={({ count }) => applyRegistration(count)}
              />
            </div>
          ) : viewerRole === null ? (
            <Link
              href="/login"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <LogIn aria-hidden="true" className="w-4 h-4" />
              Masuk sebagai UMKM untuk Mendaftar
            </Link>
          ) : (
            <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
              Pendaftaran hanya untuk akun UMKM.
            </div>
          )}
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Share2 aria-hidden="true" className="w-4 h-4" />
            Bagikan via WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}
