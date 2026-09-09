import type { ReportEntry } from "./types";

export const SUPPLIER_REPORT_MOCKS: readonly ReportEntry[] = [
  {
    id: "report-001",
    registrationId: "reg-006",
    batchId: "batch-active-001",
    batchTitle: "Kentang Granola Segar",
    batchDisplayCode: "BATCH-20260825-002",
    umkmId: "umkm-003",
    umkmName: "Toko Sembako Jaya",
    description:
      "UMKM mengambil barang dengan kualitas di bawah standar. Sebagian kantong rusak dan isinya busuk. Bukti foto terlampir.",
    photoUrls: ["/file.svg"],
    status: "under_review",
    adminNotes: null,
    decidedAt: null,
    escrowStatus: "held",
    createdAt: "2026-09-02T14:00:00.000Z",
  },
  {
    id: "report-002",
    registrationId: "reg-007",
    batchId: "batch-paid-001",
    batchTitle: "Ikan Nila Segar",
    batchDisplayCode: "BATCH-20260825-003",
    umkmId: "umkm-005",
    umkmName: "Katering Padang Makmur",
    description:
      "UMKM tidak hadir mengambil barang sesuai jadwal (No-Show). Dana hangus sebagai kompensasi.",
    photoUrls: [],
    status: "resolved_supplier",
    adminNotes: "UMKM tidak hadir setelah 12 jam toleransi. Dana dialihkan ke supplier.",
    decidedAt: "2026-08-29T20:00:00.000Z",
    escrowStatus: "forfeited",
    createdAt: "2026-08-29T19:30:00.000Z",
  },
  {
    id: "report-003",
    registrationId: "reg-008",
    batchId: "batch-cancelled-001",
    batchTitle: "Tahu Sumedang 50 pcs",
    batchDisplayCode: "BATCH-20260820-005",
    umkmId: "umkm-001",
    umkmName: "Catering Enak",
    description:
      "Barang yang diterima tidak sesuai pesanan. Jumlah kurang dan beberapa tahu sudah basah.",
    photoUrls: ["/file.svg", "/file.svg"],
    status: "resolved_umkm",
    adminNotes:
      "Setelah pengecekan, komplain diterima. Supplier harus mengembalikan dana penuh.",
    decidedAt: "2026-08-21T15:00:00.000Z",
    escrowStatus: "refunded",
    createdAt: "2026-08-19T10:00:00.000Z",
  },
];
