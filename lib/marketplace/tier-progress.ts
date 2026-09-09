import type { MarketplaceTier, TierProgress } from "./types";

export function deriveTierProgress(
  tiers: readonly MarketplaceTier[],
  registeredQuantity: number,
): TierProgress {
  const ordered = [...tiers].sort((a, b) => a.minVolume - b.minVolume);
  if (ordered.length === 0) {
    throw new Error("Batch tiers must not be empty");
  }

  const count = Number.isFinite(registeredQuantity)
    ? Math.max(0, registeredQuantity)
    : 0;
  const current =
    [...ordered].reverse().find((tier) => count >= tier.minVolume) ??
    ordered[0];
  const next = ordered.find((tier) => tier.minVolume > count) ?? null;

  return {
    currentTierNumber: current.tierNumber,
    currentPricePerUnit: current.pricePerUnit,
    nextTierNumber: next?.tierNumber ?? null,
    nextTierMinVolume: next?.minVolume ?? null,
    remainingToNextTier: next ? Math.max(0, next.minVolume - count) : 0,
    progressPercent: next
      ? Math.min(100, Math.round((count / next.minVolume) * 100))
      : 100,
  };
}
