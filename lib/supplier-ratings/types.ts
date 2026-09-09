import type { RatingBreakdown, RatingScore } from "@/lib/ratings/types";

export interface SupplierRatingRecent {
  buyerName: string;
  score: RatingScore;
  comment: string | null;
  createdAt: string;
}

/** Rekam jejak reputasi satu supplier untuk halaman penilaian (PRD 2.2.6). */
export interface SupplierRatings extends RatingBreakdown {
  supplierName: string;
  recent: readonly SupplierRatingRecent[];
}