import type { BatchCategory } from "@/lib/catalog/categories";

export type AsyncPhase = "idle" | "loading" | "success" | "error";

export type SupplierBatchStatus = "PUBLISHED" | "CANCELLED_BY_SUPPLIER";

export interface SupplierBatchTier {
  tierNumber: number;
  minimumQuantity: number;
  maximumQuantity: number | null;
  pricePerUnit: number;
}

export interface SupplierBatchTimeline {
  registrationOpensAt: string;
  registrationClosesAt: string;
  paymentOpensAt: string;
  paymentClosesAt: string;
  estimatedReadyAt: string;
}

export interface SupplierBatchPickup {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SupplierBatchCancellation {
  reason: string;
  actor: "SUPPLIER";
  cancelledAt: string;
}

export interface SupplierBatchDetail {
  id: string;
  displayCode: string;
  title: string;
  supplierName: string;
  category: BatchCategory;
  imageUrl: string;
  description: string;
  status: SupplierBatchStatus;
  basePrice: number;
  targetQuantity: number;
  registeredQuantity: number;
  participantCount: number;
  paidParticipantCount: number;
  tiers: readonly SupplierBatchTier[];
  timeline: SupplierBatchTimeline;
  pickup: SupplierBatchPickup;
  cancellation: SupplierBatchCancellation | null;
}

export interface SupplierBatchCancellationInput {
  reason: string;
}

export interface SupplierBatchRepository {
  getById(id: string, options?: { signal?: AbortSignal }): Promise<SupplierBatchDetail | null>;
  cancel(
    id: string,
    input: SupplierBatchCancellationInput,
    options?: { signal?: AbortSignal },
  ): Promise<SupplierBatchDetail>;
}
