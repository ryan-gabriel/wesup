import type {
  ComplaintScenario,
  DisputeRecord,
  RefundTicket,
} from "./types";

const HOUR_MS = 60 * 60 * 1000;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString();
}

function pickupWindow(hoursAgoPickup: number): {
  pickedUpAt: string;
  deadlineAt: string;
} {
  const pickedUpAt = hoursAgo(hoursAgoPickup);
  return {
    pickedUpAt,
    deadlineAt: new Date(new Date(pickedUpAt).getTime() + 24 * HOUR_MS).toISOString(),
  };
}

const PRIMARY_DISPUTES: Record<string, DisputeRecord> = {
  "ord-umkm-009": {
    id: "disp-umkm-009",
    orderId: "ord-umkm-009",
    complaintCategory: "cacat",
    description:
      "Saat tiba di titik kumpul, sebagian jagung ditemukan rusak dan sebagian sisanya sudah mulai layu. Bukti foto diambil langsung di lokasi sebelum dibawa pulang.",
    photos: [
      {
        url: "mock://wesup-assets/disputes/disp-umkm-009/1.webp",
        caption: "Foto kiriman saat di lokasi",
      },
      {
        url: "mock://wesup-assets/disputes/disp-umkm-009/2.webp",
        caption: "Klose-up bagian yang rusak",
      },
    ],
    status: "under_review",
    createdAt: hoursAgo(18),
    decidedAt: null,
    adminNotes: null,
    escrowStatus: "frozen",
    escrowSuspendedAt: hoursAgo(18),
  },
  "ord-umkm-010": {
    id: "disp-umkm-010",
    orderId: "ord-umkm-010",
    complaintCategory: "busuk",
    description:
      "Jamur tiram berbau tidak segar dan sebagian kemasan sudah berair. Keluhan diajukan dalam 12 jam setelah pengambilan.",
    photos: [
      {
        url: "mock://wesup-assets/disputes/disp-umkm-010/1.webp",
        caption: "Kondisi kemasan saat diterima",
      },
    ],
    status: "resolved_umkm",
    createdAt: hoursAgo(22),
    decidedAt: hoursAgo(11),
    adminNotes:
      "Bukti foto sesuai rekam jejak persetujuan lokasi. Sengketa dimenangkan UMKM — dana dikembalikan penuh.",
    escrowStatus: "refunded",
    escrowSuspendedAt: hoursAgo(22),
  },
  "ord-umkm-011": {
    id: "disp-umkm-011",
    orderId: "ord-umkm-011",
    complaintCategory: "cacat",
    description:
      "Sebagian wortel terlihat pecah. Namun barang masih layak jual dan tidak ada bukti penyimpanan tidak benar di titik kumpul.",
    photos: [
      {
        url: "mock://wesup-assets/disputes/disp-umkm-011/1.webp",
        caption: "Foto kondisi wortel",
      },
    ],
    status: "resolved_supplier",
    createdAt: hoursAgo(25),
    decidedAt: hoursAgo(9),
    adminNotes:
      "Bukti foto dianggap tidak meyakinkan dan tidak didukung catatan kejadian lapangan. Komplain ditolak — dana dirilis ke Supplier.",
    escrowStatus: "released",
    escrowSuspendedAt: hoursAgo(25),
  },
};

const OPEN_WINDOWS: Record<string, { pickedUpAt: string; deadlineAt: string }> = {
  "ord-umkm-008": pickupWindow(5),
};

const PRIMARY_REFUNDS: Record<string, RefundTicket> = {
  "ord-umkm-010": {
    id: "ref-umkm-010",
    orderId: "ord-umkm-010",
    status: "waiting_bank_account",
    trigger: "dispute_won",
    amount: 1_240_000,
    bankAccount: null,
    createdAt: hoursAgo(11),
    updatedAt: null,
  },
};

export function getComplaintScenario(orderId: string): ComplaintScenario | null {
  const dispute = PRIMARY_DISPUTES[orderId];
  if (dispute) {
    return {
      kind: "filed",
      dispute,
      refund: PRIMARY_REFUNDS[orderId] ?? null,
    };
  }

  const open = OPEN_WINDOWS[orderId];
  if (open) {
    return {
      kind: "window_open",
      pickedUpAt: open.pickedUpAt,
      deadlineAt: open.deadlineAt,
    };
  }

  if (orderId === "ord-umkm-003") {
    return {
      kind: "window_closed",
      pickedUpAt: "2026-09-01T03:10:00.000Z",
      deadlineAt: "2026-09-02T03:10:00.000Z",
    };
  }

  return null;
}