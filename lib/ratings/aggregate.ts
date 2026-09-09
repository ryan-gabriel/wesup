import type {
  RatingBreakdown,
  RatingOrderView,
  RatingRecord,
  RatingScenario,
  RatingScore,
} from "./types";

const ZERO_COUNTS: Record<RatingScore, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

/**
 * Business Rule PRD 2.2.6: kolom rating dikunci dan tidak dirender sebelum
 * serah-terima fisik (pickup) terbukti rampung — mencegah review bombing prematur.
 * Hanya status `picked_up` milik role buyer yang membuka kolom.
 */
export function isRatingUnlocked(order: RatingOrderView): boolean {
  return order.role === "buyer" && order.status === "picked_up";
}

/**
 * Menentukan skenario akses form rating untuk satu baris pesanan.
 * Prioritas: rating sudah ada (1 per transaksi) → No-Show (diblokir mutlak) →
 * unlocked setelah pickup → selainnya terkunci.
 */
export function getRatingScenario(
  order: RatingOrderView,
  existing: RatingRecord | null = null,
): RatingScenario {
  if (existing) {
    return { kind: "already_rated", rating: existing };
  }
  if (order.role !== "buyer") {
    return { kind: "locked_pre_pickup" };
  }
  if (order.status === "picked_up") {
    return { kind: "unlocked" };
  }
  if (order.status === "no_show") {
    return { kind: "blocked_no_show" };
  }
  return { kind: "locked_pre_pickup" };
}

const SCORE_KEYS: RatingScore[] = [1, 2, 3, 4, 5];

/** Agregat rating: rata-rata, total, dan distribusi per bintang 1–5. */
export function buildRatingBreakdown(
  ratings: readonly { score: RatingScore }[],
): RatingBreakdown {
  const scoreCounts: Record<RatingScore, number> = { ...ZERO_COUNTS };
  for (const { score } of ratings) {
    scoreCounts[score] += 1;
  }
  const total = ratings.length;
  const sum = ratings.reduce((acc, rating) => acc + rating.score, 0);
  const average = total === 0 ? 0 : sum / total;
  const orderedScoreCounts = Object.fromEntries(
    SCORE_KEYS.map((score) => [score, scoreCounts[score]]),
  ) as Record<RatingScore, number>;

  return { scoreCounts: orderedScoreCounts, total, average };
}