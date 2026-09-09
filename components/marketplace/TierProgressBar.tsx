"use client";

import type { MarketplaceTier, TierProgress } from "@/lib/marketplace/types";

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export interface TierProgressBarProps {
  registeredQuantity: number;
  tiers: readonly MarketplaceTier[];
  tierProgress: TierProgress;
  targetQuantity?: number;
  showPrice?: boolean;
  className?: string;
}

export default function TierProgressBar({
  registeredQuantity,
  tiers,
  tierProgress,
  targetQuantity,
  showPrice = true,
  className = "",
}: TierProgressBarProps) {
  const currentTier = tiers.find(
    (tier) => tier.tierNumber === tierProgress.currentTierNumber,
  );
  const progressPercent = Math.max(0, Math.min(100, tierProgress.progressPercent));
  const targetCopy =
    typeof targetQuantity === "number" && targetQuantity > 0
      ? `Target Kelompok: ${registeredQuantity}/${targetQuantity} Porsi`
      : `${registeredQuantity} unit terkumpul`;

  return (
    <section
      className={`flex flex-col gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
      aria-label="Progress volume dan harga tier"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-blue-700">{targetCopy}</span>
          <span className="text-xs font-medium text-slate-500">
            {registeredQuantity} unit terkumpul • Tier {tierProgress.currentTierNumber}
          </span>
        </div>
        <span className="font-bold text-slate-700">{progressPercent}%</span>
      </div>

      <div
        className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner"
        role="progressbar"
        aria-label="Progres target kelompok"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
      >
        <div
          className="h-full bg-blue-600 rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {showPrice ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-sm font-bold text-slate-900">
            {rupiahFormatter.format(tierProgress.currentPricePerUnit)} / unit
          </span>
          {currentTier && currentTier.pricePerUnit !== tierProgress.currentPricePerUnit ? (
            <span className="text-xs text-slate-400">
              Tier {currentTier.tierNumber}: {rupiahFormatter.format(currentTier.pricePerUnit)}
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs font-medium text-slate-500" aria-live="polite">
        {tierProgress.nextTierNumber === null
          ? "Tier terbaik tercapai"
          : `${tierProgress.remainingToNextTier} unit lagi menuju Tier ${tierProgress.nextTierNumber}`}
      </p>
    </section>
  );
}
