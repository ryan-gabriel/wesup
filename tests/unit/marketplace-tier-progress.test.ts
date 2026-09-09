import { describe, expect, it } from "vitest";
import { deriveTierProgress } from "@/lib/marketplace/tier-progress";

const tiers = [
  { tierNumber: 1, minVolume: 1, maxVolume: 49, pricePerUnit: 25_000 },
  { tierNumber: 2, minVolume: 50, maxVolume: 99, pricePerUnit: 22_000 },
  { tierNumber: 3, minVolume: 100, maxVolume: null, pricePerUnit: 20_000 },
];

describe("deriveTierProgress", () => {
  it("uses tier 1 as fallback below the next discount threshold", () => {
    expect(deriveTierProgress(tiers, 30)).toMatchObject({
      currentTierNumber: 1,
      currentPricePerUnit: 25_000,
      nextTierNumber: 2,
      nextTierMinVolume: 50,
      remainingToNextTier: 20,
      progressPercent: 60,
    });
  });

  it("moves to the achieved tier at its exact minimum", () => {
    expect(deriveTierProgress(tiers, 50)).toMatchObject({
      currentTierNumber: 2,
      nextTierNumber: 3,
      remainingToNextTier: 50,
    });
  });

  it("reports completion after the final tier is achieved", () => {
    expect(deriveTierProgress(tiers, 120)).toMatchObject({
      currentTierNumber: 3,
      nextTierNumber: null,
      remainingToNextTier: 0,
      progressPercent: 100,
    });
  });
});
