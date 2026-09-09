export type AccountOrderStatus =
  | "registered"
  | "pending_payment"
  | "paid"
  | "picked_up"
  | "no_show"
  | "cancelled";

/** Lightweight order record shown in the "Pesanan" center (mock feed). */
export interface AccountOrder {
  id: string;
  batchId: string;
  batchTitle: string;
  batchDisplayCode: string;
  role: "buyer" | "supplier";
  counterparty: string;
  quantity: number;
  unit: string;
  finalAmount: number;
  status: AccountOrderStatus;
  lockedTier: number | null;
  createdAt: string;
  pickupUrl?: string;
  paymentUrl?: string;
}

/**
 * Kredensial serah-terima yang ditampilkan di halaman
 * `/pesanan/[orderId]/serah-terima` (PRD 2.2.4).
 * QR & PIN hanya terbit ketika status `paid`; `pickupCode`/`pinCode`
 * bernilai `null` pada status lain.
 */
export interface PickupCredential {
  orderId: string;
  batchId: string;
  batchTitle: string;
  batchDisplayCode: string;
  supplierName: string;
  quantity: number;
  unit: string;
  lockedTier: number | null;
  finalAmount: number;
  status: AccountOrderStatus;
  pickupAddress: string;
  /** Waktu Estimasi Ready (awal jendela 12 jam toleransi). */
  estimatedReadyAt: string;
  /** Estimasi Ready + 12 jam toleransi operasional (PRD 2.2.4). */
  pickupDeadlineAt: string;
  pickupCode: string | null;
  pinCode: string | null;
  pickedUpAt: string | null;
}