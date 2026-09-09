export type PaymentResolution =
  | "open" // window aktif — tagihan dapat dibayar
  | "waiting" // sebelum window dibuka — countdown ke buka
  | "expired" // window lewat tanpa bayar — sanksi Hit & Run
  | "paid"; // sudah dibayar lunas

/** Sanksi berjenjang Hit & Run per PRD 2.2.3. */
export type StrikeLevel = 1 | 2 | 3;

export interface StrikePolicy {
  level: StrikeLevel;
  label: string;
  description: string;
}

export interface PaymentInvoice {
  id: string;
  orderId: string;
  batchId: string;
  batchDisplayCode: string;
  batchTitle: string;
  supplierName: string;
  quantity: number;
  unit: string;
  lockedTier: number;
  tierPricePerUnit: number;
  basePricePerUnit: number;
  grossAmount: number;
  midtransOrderId: string;
  pickupAddress: string;
  /** Waktu absolut dari API Gatekeeper (mock server) — sumber kebenaran countdown. */
  serverTimestamp: string;
  paymentOpensAt: string;
  paymentClosesAt: string;
  estimatedReadyAt: string;
  /** Hanya diisi ketika window terlewat: sanksi yang dijatuhkan. */
  strikes?: StrikeLevel;
  resolution: PaymentResolution;
}