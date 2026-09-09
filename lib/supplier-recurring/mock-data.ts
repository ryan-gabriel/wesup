import type { RecurringConfig } from "./types";

const DEFAULT_TEMPLATE_PICKUP = {
  pickupName: "Gudang Wesup Bandung",
  pickupAddress: "Jl. Asia Afrika No. 81, Braga, Sumur Bandung, Kota Bandung 40111",
  pickupLatitude: -6.921857,
  pickupLongitude: 107.609729,
} as const;

export const RECURRING_CONFIG_MOCKS: readonly RecurringConfig[] = [
  {
    id: "recurring-001",
    supplierId: "supplier-001",
    name: "Beras Rojolele Mingguan",
    intervalDays: 7,
    daysOfWeek: [1, 4],
    isActive: true,
    lastGeneratedAt: "2026-08-28T00:00:00.000Z",
    nextGenerationAt: "2026-09-04T00:00:00.000Z",
    templateBatch: {
      title: "Beras Rojolele 5 kg",
      category: "Makanan Siap Saji",
      description: "Beras pilihan untuk kebutuhan usaha kuliner di Bandung.",
      tiers: [
        { tierNumber: 1, minimumQuantity: 1, maximumQuantity: 24, pricePerUnit: 75_000 },
        { tierNumber: 2, minimumQuantity: 25, maximumQuantity: 49, pricePerUnit: 71_000 },
        { tierNumber: 3, minimumQuantity: 50, maximumQuantity: null, pricePerUnit: 68_000 },
      ],
      ...DEFAULT_TEMPLATE_PICKUP,
    },
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  },
  {
    id: "recurring-002",
    supplierId: "supplier-001",
    name: "Kentang Granola Segar",
    intervalDays: 3,
    daysOfWeek: [1, 3, 5],
    isActive: true,
    lastGeneratedAt: "2026-08-30T00:00:00.000Z",
    nextGenerationAt: "2026-09-02T00:00:00.000Z",
    templateBatch: {
      title: "Kentang Granola Segar",
      category: "Sayur & Buah",
      description: "Kentang granola segar untuk warung dan UMKM Bandung.",
      tiers: [
        { tierNumber: 1, minimumQuantity: 1, maximumQuantity: 49, pricePerUnit: 18_000 },
        { tierNumber: 2, minimumQuantity: 50, maximumQuantity: 99, pricePerUnit: 16_500 },
        { tierNumber: 3, minimumQuantity: 100, maximumQuantity: null, pricePerUnit: 15_000 },
      ],
      pickupName: "Titik Ambil Pasar Kosambi",
      pickupAddress: "Jl. Ahmad Yani No. 221, Kebon Pisang, Sumur Bandung, Kota Bandung 40112",
      pickupLatitude: -6.923543,
      pickupLongitude: 107.615188,
    },
    createdAt: "2026-08-10T09:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
  },
  {
    id: "recurring-003",
    supplierId: "supplier-001",
    name: "Ikan Nila Segar Bulanan",
    intervalDays: 30,
    daysOfWeek: [],
    isActive: false,
    lastGeneratedAt: null,
    nextGenerationAt: "2026-10-01T00:00:00.000Z",
    templateBatch: {
      title: "Ikan Nila Segar",
      category: "Daging & Ikan",
      description: "Ikan nila segar untuk rumah makan dan katering Bandung.",
      tiers: [
        { tierNumber: 1, minimumQuantity: 1, maximumQuantity: 29, pricePerUnit: 32_000 },
        { tierNumber: 2, minimumQuantity: 30, maximumQuantity: 59, pricePerUnit: 30_000 },
        { tierNumber: 3, minimumQuantity: 60, maximumQuantity: null, pricePerUnit: 28_000 },
      ],
      pickupName: "Titik Ambil Cibiru",
      pickupAddress: "Jl. Soekarno-Hatta No. 781, Cisaranten Kidul, Gedebage, Kota Bandung 40295",
      pickupLatitude: -6.948067,
      pickupLongitude: 107.702743,
    },
    createdAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-08-15T10:00:00.000Z",
  },
];

export function computeNextGeneration(
  lastDate: Date,
  intervalDays: number,
  daysOfWeek: number[],
): Date {
  const next = new Date(lastDate);
  next.setDate(next.getDate() + intervalDays);

  if (daysOfWeek.length > 0) {
    while (!daysOfWeek.includes(next.getDay())) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

export function formatInterval(days: number): string {
  if (days === 1) return "Setiap hari";
  if (days === 7) return "Setiap minggu";
  if (days === 14) return "Setiap 2 minggu";
  if (days === 30) return "Setiap bulan";
  return `Setiap ${days} hari`;
}
