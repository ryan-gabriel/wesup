import { isBatchCategory, type BatchCategory } from "@/lib/catalog/categories";
import type { CatalogDraft } from "@/lib/supplier-catalog/types";
import type { CatalogMutationInput, CatalogTierMutationInput } from "@/lib/supplier-catalog/validation";
import type { SupplierBatchDetail, SupplierBatchStatus } from "@/lib/supplier-batch/types";

export interface SupplierCatalogPayload {
  title: string;
  category: BatchCategory | "";
  description: string;
  targetQuantity: number;
  pickupName: string;
  pickupAddress: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  registrationOpensAt: string;
  registrationClosesAt: string;
  paymentOpensAt: string;
  paymentClosesAt: string;
  estimatedReadyAt: string;
  tiers: CatalogTierMutationInput[];
}

export interface SupplierBatchRpcRow {
  id?: unknown;
  supplier_name?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  min_quantity?: unknown;
  product_photo_url?: unknown;
  pickup_name?: unknown;
  pickup_address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  status?: unknown;
  registration_opens_at?: unknown;
  registration_closes_at?: unknown;
  payment_opens_at?: unknown;
  payment_closes_at?: unknown;
  estimated_ready_at?: unknown;
  tiers?: unknown;
  registered_quantity?: unknown;
  participant_count?: unknown;
  paid_participant_count?: unknown;
  cancelled_reason?: unknown;
  updated_at?: unknown;
  created_at?: unknown;
}

export interface SupplierCatalogListResponse {
  items: SupplierBatchDetail[];
  counts: Record<"ALL" | SupplierBatchStatus, number>;
}

export function draftToPayload(draft: CatalogDraft): SupplierCatalogPayload {
  return {
    title: draft.title,
    category: draft.category,
    description: draft.description,
    targetQuantity: draft.targetQuantity,
    pickupName: draft.pickupName,
    pickupAddress: draft.pickupAddress,
    pickupLatitude: draft.pickupLatitude,
    pickupLongitude: draft.pickupLongitude,
    registrationOpensAt: draft.registrationOpensAt,
    registrationClosesAt: draft.registrationClosesAt,
    paymentOpensAt: draft.paymentOpensAt,
    paymentClosesAt: draft.paymentClosesAt,
    estimatedReadyAt: draft.estimatedReadyAt,
    tiers: draft.tiers.map((tier) => ({ ...tier })),
  };
}

export function payloadToMutation(payload: SupplierCatalogPayload, productPhotoUrl: string | null = null): CatalogMutationInput {
  return { ...payload, productPhotoUrl };
}

export function parseSupplierCatalogPayload(value: unknown): SupplierCatalogPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if ("supplierId" in record) return null;
  const stringValue = (key: string): string | null => typeof record[key] === "string" ? record[key] as string : null;
  const numberValue = (key: string): number | null => typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] as number : null;
  const category = stringValue("category");
  const tiers = Array.isArray(record.tiers) ? record.tiers.map(parseTier) : null;
  if (!tiers || tiers.some((tier) => tier === null)) return null;
  const values = {
    title: stringValue("title"),
    category,
    description: stringValue("description"),
    targetQuantity: numberValue("targetQuantity"),
    pickupName: stringValue("pickupName"),
    pickupAddress: stringValue("pickupAddress"),
    pickupLatitude: numberValue("pickupLatitude"),
    pickupLongitude: numberValue("pickupLongitude"),
    registrationOpensAt: stringValue("registrationOpensAt"),
    registrationClosesAt: stringValue("registrationClosesAt"),
    paymentOpensAt: stringValue("paymentOpensAt"),
    paymentClosesAt: stringValue("paymentClosesAt"),
    estimatedReadyAt: stringValue("estimatedReadyAt"),
  };
  if (Object.values(values).some((entry) => entry === null)) return null;
  if (!isBatchCategory(category as string)) return null;
  return {
    title: values.title as string,
    category: category as BatchCategory,
    description: values.description as string,
    targetQuantity: values.targetQuantity as number,
    pickupName: values.pickupName as string,
    pickupAddress: values.pickupAddress as string,
    pickupLatitude: values.pickupLatitude as number,
    pickupLongitude: values.pickupLongitude as number,
    registrationOpensAt: values.registrationOpensAt as string,
    registrationClosesAt: values.registrationClosesAt as string,
    paymentOpensAt: values.paymentOpensAt as string,
    paymentClosesAt: values.paymentClosesAt as string,
    estimatedReadyAt: values.estimatedReadyAt as string,
    tiers: tiers as CatalogTierMutationInput[],
  };
}

function parseTier(value: unknown): CatalogTierMutationInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const number = (camel: string, snake: string): number | null => {
    const entry = record[camel] ?? record[snake];
    return typeof entry === "number" && Number.isFinite(entry) ? entry : null;
  };
  const maximum = record.maximumQuantity ?? record.max_volume;
  const maximumQuantity = maximum === null || maximum === undefined || maximum === ""
    ? null
    : typeof maximum === "number" && Number.isFinite(maximum) ? maximum : NaN;
  const tierNumber = number("tierNumber", "tier_number");
  const minimumQuantity = number("minimumQuantity", "min_volume");
  const pricePerUnit = number("pricePerUnit", "price_per_unit");
  if (tierNumber === null || minimumQuantity === null || pricePerUnit === null || (typeof maximumQuantity === "number" && !Number.isFinite(maximumQuantity))) return null;
  return { tierNumber, minimumQuantity, maximumQuantity, pricePerUnit };
}

export function mapSupplierBatchRow(row: SupplierBatchRpcRow): SupplierBatchDetail {
  const tiers = parseTiers(row.tiers);
  const status = mapStatus(row.status);
  const id = String(row.id ?? "");
  const registeredQuantity = number(row.registered_quantity);
  const participantCount = number(row.participant_count);
  const paidParticipantCount = number(row.paid_participant_count);
  const photo = typeof row.product_photo_url === "string" && row.product_photo_url.trim() !== ""
    ? row.product_photo_url
    : "/file.svg";
  return {
    id,
    displayCode: `BATCH-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
    title: string(row.title, "Penawaran Wesup"),
    supplierName: string(row.supplier_name, "Supplier Wesup"),
    category: isBatchCategory(String(row.category ?? "")) ? String(row.category) as BatchCategory : "Jasa",
    imageUrl: photo,
    description: string(row.description, ""),
    status,
    basePrice: tiers[0]?.pricePerUnit ?? 0,
    targetQuantity: Math.max(1, Math.trunc(number(row.min_quantity, 1))),
    registeredQuantity,
    participantCount,
    paidParticipantCount,
    tiers,
    timeline: {
      registrationOpensAt: string(row.registration_opens_at, ""),
      registrationClosesAt: string(row.registration_closes_at, ""),
      paymentOpensAt: string(row.payment_opens_at, ""),
      paymentClosesAt: string(row.payment_closes_at, ""),
      estimatedReadyAt: string(row.estimated_ready_at, ""),
    },
    pickup: {
      name: string(row.pickup_name, string(row.pickup_address, "Lokasi pickup")),
      address: string(row.pickup_address, "Lokasi pickup"),
      latitude: number(row.latitude),
      longitude: number(row.longitude),
    },
    cancellation: status === "CANCELLED_BY_SUPPLIER"
      ? { reason: string(row.cancelled_reason, ""), actor: "SUPPLIER", cancelledAt: string(row.updated_at, "") }
      : null,
  };
}

export function parseTiers(value: unknown): SupplierBatchDetail["tiers"] {
  if (!Array.isArray(value)) return [];
  return value.map(parseTier).filter((tier): tier is CatalogTierMutationInput => tier !== null).map((tier) => ({
    tierNumber: tier.tierNumber,
    minimumQuantity: tier.minimumQuantity,
    maximumQuantity: tier.maximumQuantity,
    pricePerUnit: tier.pricePerUnit,
  }));
}

function number(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function string(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function mapStatus(value: unknown): SupplierBatchStatus {
  switch (value) {
    case "draft": return "DRAFT";
    case "published": return "PUBLISHED";
    case "closed": return "CLOSED";
    case "cancelled": return "CANCELLED_BY_SUPPLIER";
    case "takedown": return "TAKEDOWN";
    case "completed": return "COMPLETED";
    default: return "DRAFT";
  }
}
