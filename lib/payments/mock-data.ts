import type { PaymentInvoice } from "./types";

/**
 * Static invoice fixtures for the Payment Window UI base.
 * `serverTimestamp` acts as the authoritative API Gatekeeper time — the
 * countdown and gate states derive from it, never from the device clock.
 * A later role replaces this module with the real Supabase + Midtrans data.
 */
export const PAYMENT_INVOICE_MOCKS: readonly PaymentInvoice[] = [
  // ── Gate: OPEN — window aktif, tagihan siap dibayar ──────────────────────
  {
    id: "pay-open-001",
    orderId: "ord-umkm-002",
    batchId: "batch-active-001",
    batchDisplayCode: "BATCH-20260825-002",
    batchTitle: "Kentang Granola Segar",
    supplierName: "PT Agri Sejahtera",
    quantity: 80,
    unit: "kg",
    lockedTier: 2,
    tierPricePerUnit: 9_500,
    basePricePerUnit: 11_000,
    grossAmount: 760_000,
    midtransOrderId: "WS-20260828-000213",
    pickupAddress: "Jl. Asia Afrika No. 123, Bandung",
    serverTimestamp: "2026-08-28T14:00:00.000Z",
    paymentOpensAt: "2026-08-28T10:00:01.000Z",
    paymentClosesAt: "2026-08-29T08:00:00.000Z",
    estimatedReadyAt: "2026-08-30T07:00:00.000Z",
    resolution: "open",
  },
  // ── Gate: WAITING — sebelum window dibuka, countdown ke buka ──────────────
  {
    id: "pay-waiting-001",
    orderId: "ord-umkm-006",
    batchId: "batch-waiting-001",
    batchDisplayCode: "BATCH-20260830-004",
    batchTitle: "Cabai Merah Premium",
    supplierName: "Mitra Tani Bandung",
    quantity: 40,
    unit: "kg",
    lockedTier: 1,
    tierPricePerUnit: 25_000,
    basePricePerUnit: 25_000,
    grossAmount: 1_000_000,
    midtransOrderId: "WS-20260830-000087",
    pickupAddress: "Jl. Dago No. 45, Bandung",
    serverTimestamp: "2026-08-28T07:00:00.000Z",
    paymentOpensAt: "2026-08-28T10:00:01.000Z",
    paymentClosesAt: "2026-08-29T08:00:00.000Z",
    estimatedReadyAt: "2026-08-30T07:00:00.000Z",
    resolution: "waiting",
  },
  // ── Gate: EXPIRED — window terlewat, sanksi Hit & Run (strike 1) ──────────
  {
    id: "pay-expired-001",
    orderId: "ord-umkm-007",
    batchId: "batch-expired-001",
    batchDisplayCode: "BATCH-20260824-009",
    batchTitle: "Ikan Nila Segar",
    supplierName: "Tambak Berkah Abadi",
    quantity: 30,
    unit: "kg",
    lockedTier: 2,
    tierPricePerUnit: 30_000,
    basePricePerUnit: 34_000,
    grossAmount: 900_000,
    midtransOrderId: "WS-20260824-000142",
    pickupAddress: "Jl. Buah Batu No. 88, Bandung",
    serverTimestamp: "2026-08-29T09:00:00.000Z",
    paymentOpensAt: "2026-08-25T10:00:01.000Z",
    paymentClosesAt: "2026-08-26T08:00:00.000Z",
    estimatedReadyAt: "2026-08-27T07:00:00.000Z",
    strikes: 1,
    resolution: "expired",
  },
  // ── Gate: PAID — invoice lunas via webhook ────────────────────────────────
  {
    id: "pay-paid-001",
    orderId: "ord-umkm-001",
    batchId: "batch-active-001",
    batchDisplayCode: "BATCH-20260825-002",
    batchTitle: "Kentang Granola Segar",
    supplierName: "PT Agri Sejahtera",
    quantity: 120,
    unit: "kg",
    lockedTier: 2,
    tierPricePerUnit: 9_500,
    basePricePerUnit: 11_000,
    grossAmount: 1_140_000,
    midtransOrderId: "WS-20260826-000094",
    pickupAddress: "Jl. Asia Afrika No. 123, Bandung",
    serverTimestamp: "2026-08-27T09:00:00.000Z",
    paymentOpensAt: "2026-08-26T10:00:01.000Z",
    paymentClosesAt: "2026-08-27T08:00:00.000Z",
    estimatedReadyAt: "2026-08-28T07:00:00.000Z",
    resolution: "paid",
  },
];

export function getPaymentInvoiceMock(
  orderId: string,
): PaymentInvoice | undefined {
  return PAYMENT_INVOICE_MOCKS.find(
    (invoice) => invoice.orderId === orderId,
  );
}