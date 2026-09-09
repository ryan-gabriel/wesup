import { isBatchCategory, type BatchCategory } from "@/lib/catalog/categories";
import type { MarketplaceItem, MarketplaceTier } from "./types";

export interface MarketplaceRpcRow {
  id?: unknown;
  supplier_name?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  min_quantity?: unknown;
  product_photo_url?: unknown;
  pickup_address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  tiers?: unknown;
  registered_quantity?: unknown;
  current_price_per_unit?: unknown;
  registration_closes_at?: unknown;
  distance_km?: unknown;
  total_count?: unknown;
}

const FALLBACK_CATEGORY: BatchCategory = "Jasa";
const FALLBACK_IMAGE = "/file.svg";

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTier(value: unknown): MarketplaceTier | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const tierNumber = finiteNumber(row.tierNumber ?? row.tier_number, NaN);
  const minVolume = finiteNumber(row.minVolume ?? row.min_volume, NaN);
  const maxValue = row.maxVolume ?? row.max_volume;
  const maxVolume = maxValue === null || maxValue === undefined
    ? null
    : nullableFiniteNumber(maxValue);
  const pricePerUnit = finiteNumber(row.pricePerUnit ?? row.price_per_unit, NaN);
  if (
    !Number.isFinite(tierNumber) ||
    !Number.isFinite(minVolume) ||
    (maxValue !== null && maxValue !== undefined && maxVolume === null) ||
    !Number.isFinite(pricePerUnit)
  ) {
    return null;
  }
  return { tierNumber, minVolume, maxVolume, pricePerUnit };
}

export function parseMarketplaceTiers(value: unknown): MarketplaceTier[] {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(parseTier)
    .filter((tier): tier is MarketplaceTier => tier !== null)
    .sort((a, b) => a.minVolume - b.minVolume);
}

function resolveCategory(value: unknown): BatchCategory {
  return typeof value === "string" && isBatchCategory(value)
    ? value
    : FALLBACK_CATEGORY;
}

function resolveImage(value: unknown): string {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : FALLBACK_IMAGE;
}

export function mapMarketplaceRpcRow(row: MarketplaceRpcRow): MarketplaceItem {
  const tiers = parseMarketplaceTiers(row.tiers);
  const basePrice = tiers[0]?.pricePerUnit ?? finiteNumber(row.current_price_per_unit, 0);
  const currentTierPrice = finiteNumber(row.current_price_per_unit, basePrice);
  const distanceKm = nullableFiniteNumber(row.distance_km);
  const latitude = finiteNumber(row.latitude, 0);
  const longitude = finiteNumber(row.longitude, 0);

  return {
    id: String(row.id ?? ""),
    title: typeof row.title === "string" ? row.title : "Penawaran Wesup",
    supplierName:
      typeof row.supplier_name === "string" && row.supplier_name.trim() !== ""
        ? row.supplier_name
        : "Supplier Wesup",
    category: resolveCategory(row.category),
    imageUrl: resolveImage(row.product_photo_url),
    distanceKm,
    estimatedPickupMinutes:
      distanceKm === null ? null : Math.max(1, Math.ceil(distanceKm * 3)),
    basePrice,
    currentTierPrice,
    registeredQuantity: Math.max(0, Math.trunc(finiteNumber(row.registered_quantity, 0))),
    targetQuantity: Math.max(1, Math.trunc(finiteNumber(row.min_quantity, 1))),
    status: "ACTIVE",
    registrationClosesAt:
      typeof row.registration_closes_at === "string"
        ? row.registration_closes_at
        : "",
    pickupLatitude: latitude,
    pickupLongitude: longitude,
    pickupAddress:
      typeof row.pickup_address === "string" ? row.pickup_address : "Lokasi supplier",
    tiers,
  };
}

export function mapMarketplaceRpcRows(rows: readonly MarketplaceRpcRow[]): MarketplaceItem[] {
  return rows.map(mapMarketplaceRpcRow);
}
