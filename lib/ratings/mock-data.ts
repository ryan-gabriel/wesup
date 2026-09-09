import { getAccountOrderMock } from "@/lib/orders/mock-data";
import { getRatingScenario } from "./aggregate";
import type { RatingRecord, RatingScenario } from "./types";

/**
 * Fixture statis rekam jejak penilaian per transaksi (PRD 2.2.6).
 * Satu rating per registrasi (`unique(registration_id)`). Role selanjutnya
 * mengganti modul ini dengan data nyata dari tabel `ratings`.
 *
 * Catatan: record di sini sengaja minor — pesanan `picked_up` yang belum ada
 * record-nya (contoh `ord-umkm-003`) tetap "unlocked" agar form bisa didemokan.
 */
export const RATING_RECORD_MOCKS: readonly RatingRecord[] = [
  {
    orderId: "ord-umkm-008",
    score: 5,
    comment:
      "Pisang datang segar, tidak ada yang penyok. Proses antrean di titik kumpul juga cepat.",
    createdAt: "2026-09-04T09:15:00.000Z",
  },
  {
    orderId: "ord-umkm-012",
    score: 4,
    comment: "Barang sesuai pesanan, hanya timing estimasi ready sedikit mundur.",
    createdAt: "2026-09-02T10:30:00.000Z",
  },
  {
    orderId: "ord-umkm-013",
    score: 3,
    comment: "Kualitas cukup, packaging perlu ditingkatkan.",
    createdAt: "2026-08-30T12:05:00.000Z",
  },
];

export function getSubmittedRating(orderId: string): RatingRecord | null {
  return RATING_RECORD_MOCKS.find((record) => record.orderId === orderId) ?? null;
}

/** Resolve skenario akses form rating berdasarkan status pesanan mock. */
export function getRatingScenarioForOrder(orderId: string): RatingScenario {
  const order = getAccountOrderMock(orderId);
  if (!order) {
    return { kind: "locked_pre_pickup" };
  }
  return getRatingScenario(order, getSubmittedRating(orderId));
}