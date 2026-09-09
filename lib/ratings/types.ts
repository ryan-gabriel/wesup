import type { AccountOrderStatus } from "@/lib/orders/types";

/** Skala bintang 1–5 dari PRD 2.2.6 (rating per transaksi). */
export type RatingScore = 1 | 2 | 3 | 4 | 5;

export type RatingOrderSide = "buyer" | "supplier";

export interface RatingOrderView {
  role: RatingOrderSide;
  status: AccountOrderStatus;
}

/** Satu rating yang sudah tersubmit — 1 per registrasi (`unique(registration_id)`). */
export interface RatingRecord {
  orderId: string;
  score: RatingScore;
  comment: string | null;
  createdAt: string;
}

export interface RatingBreakdown {
  scoreCounts: Record<RatingScore, number>;
  total: number;
  average: number;
}

/**
 * Status akses form penilaian untuk sebuah pesanan (PRD 2.2.6).
 * - `unlocked`        → serah-terima telah rampung, form boleh dirender.
 * - `already_rated`   → satu rating per transaksi sudah terisi.
 * - `blocked_no_show` → Validasi Input: No-Show diblokir mutlak.
 * - `locked_pre_pickup` → Business Rule: tidak di-render sebelum pickup selesai.
 */
export type RatingScenario =
  | { kind: "unlocked" }
  | { kind: "already_rated"; rating: RatingRecord }
  | { kind: "blocked_no_show" }
  | { kind: "locked_pre_pickup" };