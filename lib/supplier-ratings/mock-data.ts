import type {
  SupplierRatingRecent,
  SupplierRatings,
} from "./types";

export const SUPPLIER_RATINGS_MOCKS: readonly SupplierRatings[] = [
  {
    supplierName: "Koperasi Pangan Bandung",
    scoreCounts: { 1: 1, 2: 2, 3: 4, 4: 6, 5: 12 },
    total: 25,
    average: 4.04,
    recent: [
      {
        buyerName: "Warung Berkah",
        score: 5,
        comment:
          "Beras belanjaan selaras dengan spesifikasi, penimbangan transparan di titik kumpul.",
        createdAt: "2026-09-04T09:15:00.000Z",
      },
      {
        buyerName: "Dapur Mami",
        score: 4,
        comment:
          "Kualitas bagus. Antrean pickup lumayan ramai, tapi tetap tertib.",
        createdAt: "2026-09-02T11:40:00.000Z",
      },
      {
        buyerName: "Kedai Sejahtera",
        score: 5,
        comment:
          "Petugas bersedia menolong loading barang. Sangat membantu untuk usaha kecil.",
        createdAt: "2026-09-01T08:20:00.000Z",
      },
      {
        buyerName: "Toko Lancar Jaya",
        score: 3,
        comment:
          "Produk sesuai, namun estimasi waktu ready sempat mundur 1 jam.",
        createdAt: "2026-08-30T13:05:00.000Z",
      },
    ],
  },
  {
    supplierName: "PT Agri Sejahtera",
    scoreCounts: { 1: 0, 2: 1, 3: 3, 4: 8, 5: 10 },
    total: 22,
    average: 4.23,
    recent: [
      {
        buyerName: "Pasar Segar Arthah",
        score: 5,
        comment: "Kentang seragam ukurannya, packing aman.",
        createdAt: "2026-09-03T10:10:00.000Z",
      },
      {
        buyerName: "Agen Pangan Prima",
        score: 4,
        comment: "Sesuai janji. Semoga stock reguler untuk batch berikutnya.",
        createdAt: "2026-09-02T09:00:00.000Z",
      },
    ],
  },
];

export function getSupplierRatings(
  supplierName: string,
): SupplierRatings | null {
  return (
    SUPPLIER_RATINGS_MOCKS.find(
      (entry) => entry.supplierName === supplierName,
    ) ?? null
  );
}

export interface RatingBarRow {
  score: 1 | 2 | 3 | 4 | 5;
  count: number;
  pct: number;
}

const SCORE_KEYS = [1, 2, 3, 4, 5] as const;

/** Distribusi per bintang untuk bilah visual di halaman reputasi supplier. */
export function ratingBarsFor(summary: SupplierRatings): RatingBarRow[] {
  return SCORE_KEYS.map((score) => {
    const count = summary.scoreCounts[score];
    const pct = summary.total <= 0 ? 0 : (count / summary.total) * 100;
    return { score, count, pct };
  });
}

export function recentRatingNotes(
  summary: SupplierRatings,
): SupplierRatingRecent[] {
  return [...summary.recent]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);
}