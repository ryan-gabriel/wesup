import type { PickupCredential } from "./types";

/**
 * Fixture statis kredensial serah-terima per pesanan UMKM (PRD 2.2.4).
 * `pickupCode`/`pinCode` hanya terisi ketika status `paid` — mencerminkan
 * aturan Validasi Input: QR & PIN hanya diterbitkan setelah tagihan lunas.
 * Role selanjutnya mengganti modul ini dengan data nyata dari database.
 */

const ESTIMATED_READY = "2026-08-28T07:00:00.000Z";
const PICKUP_DEADLINE = "2026-08-28T19:00:00.000Z";

export const PICKUP_CREDENTIAL_MOCKS: readonly PickupCredential[] = [
  // ── paid: QR + PIN terbit, siap serah terima ─────────────────────────────
  {
    orderId: "ord-umkm-001",
    batchId: "batch-active-001",
    batchTitle: "Kentang Granola Segar",
    batchDisplayCode: "BATCH-20260825-002",
    supplierName: "PT Agri Sejahtera",
    quantity: 120,
    unit: "kg",
    lockedTier: 2,
    finalAmount: 1_140_000,
    status: "paid",
    pickupAddress: "Jl. Asia Afrika No. 123, Bandung",
    estimatedReadyAt: ESTIMATED_READY,
    pickupDeadlineAt: PICKUP_DEADLINE,
    pickupCode: "qr-token-kentang-1",
    pinCode: "4821",
    pickedUpAt: null,
  },
  // ── pending_payment: kredensial belum terbit, wajib lunasi dulu ──────────
  {
    orderId: "ord-umkm-002",
    batchId: "batch-active-001",
    batchTitle: "Kentang Granola Segar",
    batchDisplayCode: "BATCH-20260825-002",
    supplierName: "PT Agri Sejahtera",
    quantity: 80,
    unit: "kg",
    lockedTier: 2,
    finalAmount: 760_000,
    status: "pending_payment",
    pickupAddress: "Jl. Asia Afrika No. 123, Bandung",
    estimatedReadyAt: ESTIMATED_READY,
    pickupDeadlineAt: PICKUP_DEADLINE,
    pickupCode: null,
    pinCode: null,
    pickedUpAt: null,
  },
  // ── registered: menunggu jendela pembayaran dibuka ───────────────────────
  {
    orderId: "ord-umkm-006",
    batchId: "batch-waiting-001",
    batchTitle: "Cabai Merah Premium",
    batchDisplayCode: "BATCH-20260830-004",
    supplierName: "Mitra Tani Bandung",
    quantity: 40,
    unit: "kg",
    lockedTier: 1,
    finalAmount: 1_000_000,
    status: "registered",
    pickupAddress: "Jl. Dago No. 45, Bandung",
    estimatedReadyAt: "2026-08-30T07:00:00.000Z",
    pickupDeadlineAt: "2026-08-30T19:00:00.000Z",
    pickupCode: null,
    pinCode: null,
    pickedUpAt: null,
  },
  // ── picked_up: selesai, escrow berjalan ──────────────────────────────────
  {
    orderId: "ord-umkm-003",
    batchId: "batch-paid-001",
    batchTitle: "Ikan Nila Segar",
    batchDisplayCode: "BATCH-20260825-003",
    supplierName: "Tambak Berkah Abadi",
    quantity: 50,
    unit: "kg",
    lockedTier: 3,
    finalAmount: 1_500_000,
    status: "picked_up",
    pickupAddress: "Jl. Buah Batu No. 88, Bandung",
    estimatedReadyAt: "2026-08-28T07:00:00.000Z",
    pickupDeadlineAt: "2026-08-28T19:00:00.000Z",
    pickupCode: null,
    pinCode: null,
    pickedUpAt: "2026-09-01T03:10:00.000Z",
  },
  {
    orderId: "ord-umkm-008",
    batchId: "batch-picked-001",
    batchTitle: "Pisang Cavendish",
    batchDisplayCode: "BATCH-20260903-011",
    supplierName: "CV Fresh Bandung",
    quantity: 100,
    unit: "sisir",
    lockedTier: 2,
    finalAmount: 950_000,
    status: "picked_up",
    pickupAddress: "Jl. Riau No. 25, Bandung",
    estimatedReadyAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    pickupDeadlineAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    pickupCode: null,
    pinCode: null,
    pickedUpAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  // ── no_show: dana hangus ─────────────────────────────────────────────────
  {
    orderId: "ord-umkm-005",
    batchId: "batch-completed-001",
    batchTitle: "Tepung Terigu Premium",
    batchDisplayCode: "BATCH-20260810-001",
    supplierName: "CV Beras Makmur",
    quantity: 60,
    unit: "kg",
    lockedTier: 1,
    finalAmount: 780_000,
    status: "no_show",
    pickupAddress: "Jl. Sukarno-Hatta No. 12, Bandung",
    estimatedReadyAt: "2026-08-06T07:00:00.000Z",
    pickupDeadlineAt: "2026-08-06T19:00:00.000Z",
    pickupCode: null,
    pinCode: null,
    pickedUpAt: null,
  },
  // ── cancelled: dibatalkan ────────────────────────────────────────────────
  {
    orderId: "ord-umkm-004",
    batchId: "batch-cancelled-001",
    batchTitle: "Tahu Sumedang 50 pcs",
    batchDisplayCode: "BATCH-20260820-005",
    supplierName: "Pabrik Tahu Sumedang",
    quantity: 100,
    unit: "pcs",
    lockedTier: 1,
    finalAmount: 450_000,
    status: "cancelled",
    pickupAddress: "Jl. Braga No. 21, Bandung",
    estimatedReadyAt: "2026-08-21T07:00:00.000Z",
    pickupDeadlineAt: "2026-08-21T19:00:00.000Z",
    pickupCode: null,
    pinCode: null,
    pickedUpAt: null,
  },
];

export function getPickupCredentialMock(
  orderId: string,
): PickupCredential | undefined {
  return PICKUP_CREDENTIAL_MOCKS.find(
    (credential) => credential.orderId === orderId,
  );
}