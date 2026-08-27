import type { BatchCategory } from "@/lib/catalog/categories";
import type { SupplierBatchDetail } from "./types";

export interface SupplierBatchCounts {
  participantCount: number;
  paidParticipantCount: number;
  registeredQuantity: number;
}

// Shape of the batches row fetched with nested batch_tiers + batch_timeline.
export interface SupplierBatchRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  min_quantity: number;
  product_photo_url: string | null;
  pickup_address: string;
  latitude: number;
  longitude: number;
  status: string;
  cancelled_reason: string | null;
  updated_at: string;
  batch_tiers: {
    tier_number: number;
    min_volume: number;
    max_volume: number | null;
    price_per_unit: number;
  }[];
  batch_timeline: {
    registration_opens_at: string;
    registration_closes_at: string;
    payment_opens_at: string;
    payment_closes_at: string;
    estimated_ready_at: string;
  } | null;
}

export function mapSupplierBatchRow(
  row: SupplierBatchRow,
  counts: SupplierBatchCounts,
): SupplierBatchDetail {
  const cancelled = row.status === "cancelled";
  const tiers = [...row.batch_tiers].sort((a, b) => a.tier_number - b.tier_number);
  return {
    // ponytail: displayCode derived from row id; real code scheme if the product asks for one
    displayCode: `WB-${row.id.slice(0, 8).toUpperCase()}`,
    id: row.id,
    title: row.title,
    supplierName: "",
    category: row.category as BatchCategory,
    imageUrl: row.product_photo_url ?? "",
    description: row.description ?? "",
    status: cancelled ? "CANCELLED_BY_SUPPLIER" : "PUBLISHED",
    basePrice: tiers[0]?.price_per_unit ?? 0,
    targetQuantity: row.min_quantity,
    registeredQuantity: counts.registeredQuantity,
    participantCount: counts.participantCount,
    paidParticipantCount: counts.paidParticipantCount,
    tiers: tiers.map((tier) => ({
      tierNumber: tier.tier_number,
      minimumQuantity: tier.min_volume,
      maximumQuantity: tier.max_volume,
      pricePerUnit: tier.price_per_unit,
    })),
    timeline: row.batch_timeline
      ? {
          registrationOpensAt: row.batch_timeline.registration_opens_at,
          registrationClosesAt: row.batch_timeline.registration_closes_at,
          paymentOpensAt: row.batch_timeline.payment_opens_at,
          paymentClosesAt: row.batch_timeline.payment_closes_at,
          estimatedReadyAt: row.batch_timeline.estimated_ready_at,
        }
      : {
          registrationOpensAt: "",
          registrationClosesAt: "",
          paymentOpensAt: "",
          paymentClosesAt: "",
          estimatedReadyAt: "",
        },
    pickup: {
      name: row.pickup_address.split(",")[0].trim(),
      address: row.pickup_address,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    },
    cancellation: cancelled
      ? {
          reason: row.cancelled_reason ?? "",
          actor: "SUPPLIER",
          cancelledAt: row.updated_at,
        }
      : null,
  };
}
