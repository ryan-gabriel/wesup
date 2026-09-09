import { BANDUNG_CENTER, isBatchCategory, type BatchCategory } from "@/lib/catalog/categories";

export const BANDUNG_CATALOG_RADIUS_KM = 50;

export interface CatalogTierMutationInput {
  tierNumber: number;
  minimumQuantity: number;
  maximumQuantity: number | null;
  pricePerUnit: number;
}

export interface CatalogMutationInput {
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
  productPhotoUrl: string | null;
}

export type CatalogValidationResult =
  | { ok: true; value: CatalogMutationInput }
  | { ok: false; fieldErrors: Record<string, string> };

export interface CatalogValidationOptions {
  /** Existing published batches may retain already elapsed timestamps. */
  allowPastTimeline?: boolean;
}

const TIMELINE_FIELDS = [
  "registrationOpensAt",
  "registrationClosesAt",
  "paymentOpensAt",
  "paymentClosesAt",
  "estimatedReadyAt",
] as const;

export function validateCatalogMutation(
  input: CatalogMutationInput,
  options: CatalogValidationOptions = {},
): CatalogValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!input.title.trim()) fieldErrors.title = "Nama produk wajib diisi.";
  if (!isBatchCategory(input.category)) fieldErrors.category = "Pilih kategori produk.";
  if (!input.description.trim()) fieldErrors.description = "Deskripsi produk wajib diisi.";
  if (input.productPhotoUrl !== null && !/^https?:\/\//i.test(input.productPhotoUrl)) fieldErrors.productPhotoUrl = "URL foto produk harus absolut.";
  if (!Number.isInteger(input.targetQuantity) || input.targetQuantity <= 0) {
    fieldErrors.targetQuantity = "Target kelompok harus berupa bilangan positif.";
  }
  if (!input.pickupName.trim()) fieldErrors.pickupName = "Nama lokasi wajib diisi.";
  if (!input.pickupAddress.trim()) fieldErrors.pickupAddress = "Alamat wajib diisi.";

  const { pickupLatitude, pickupLongitude } = input;
  if (
    pickupLatitude === null ||
    pickupLongitude === null ||
    !Number.isFinite(pickupLatitude) ||
    !Number.isFinite(pickupLongitude) ||
    distanceKm(BANDUNG_CENTER.lat, BANDUNG_CENTER.lng, pickupLatitude, pickupLongitude) > BANDUNG_CATALOG_RADIUS_KM
  ) {
    fieldErrors.pickupCoordinate = `Lokasi pickup harus berada maksimal ${BANDUNG_CATALOG_RADIUS_KM} km dari Bandung.`;
  }

  if (input.tiers.length < 2) fieldErrors.tiers = "Minimal 2 tier harga.";
  validateTiers(input.tiers, fieldErrors);
  validateTimeline(input, fieldErrors, options.allowPastTimeline === true);

  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fieldErrors }
    : { ok: true, value: input };
}

function validateTiers(
  tiers: readonly CatalogTierMutationInput[],
  fieldErrors: Record<string, string>,
) {
  tiers.forEach((tier, index) => {
    if (tier.tierNumber !== index + 1) fieldErrors.tiers = "Nomor tier harus berurutan.";
    if (!Number.isInteger(tier.minimumQuantity) || tier.minimumQuantity <= 0) {
      fieldErrors[`tiers.${index}.minimumQuantity`] = "Kuantitas minimum harus positif.";
    }
    if (tier.maximumQuantity !== null && (!Number.isInteger(tier.maximumQuantity) || tier.maximumQuantity < tier.minimumQuantity)) {
      fieldErrors[`tiers.${index}.maximumQuantity`] = "Kuantitas maksimum tidak valid.";
    }
    if (!Number.isFinite(tier.pricePerUnit) || tier.pricePerUnit <= 0) {
      fieldErrors[`tiers.${index}.pricePerUnit`] = "Harga per unit harus positif.";
    }
    if (index < tiers.length - 1 && tier.maximumQuantity === null) {
      fieldErrors[`tiers.${index}.maximumQuantity`] = "Tier selain tier terakhir wajib memiliki batas maksimum.";
    }
  });

  for (let index = 1; index < tiers.length; index += 1) {
    const previous = tiers[index - 1];
    const current = tiers[index];
    if (current.minimumQuantity <= previous.minimumQuantity || (previous.maximumQuantity !== null && current.minimumQuantity <= previous.maximumQuantity)) {
      fieldErrors.tierOverlap = "Rentang kuota antar tier tidak boleh overlap.";
    }
    if (current.pricePerUnit >= previous.pricePerUnit) {
      fieldErrors.tierInversion = "Harga tier harus menurun seiring kuantitas naik.";
    }
  }
}

function validateTimeline(
  input: CatalogMutationInput,
  fieldErrors: Record<string, string>,
  allowPast: boolean,
) {
  const times = TIMELINE_FIELDS.map((field) => Date.parse(input[field]));
  if (times.some((time) => !Number.isFinite(time))) {
    fieldErrors.timelineOrder = "Semua waktu wajib menggunakan format tanggal yang valid.";
    return;
  }
  if (times.some((time, index) => index > 0 && time <= times[index - 1])) {
    fieldErrors.timelineOrder = "Urutan waktu tidak logis.";
  }
  if (!allowPast && times.some((time) => time <= Date.now())) {
    fieldErrors.timelineOrder = "Waktu penawaran harus berada di masa depan.";
  }
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const cosine =
    Math.sin(radians(lat1)) * Math.sin(radians(lat2)) +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.cos(radians(lng2 - lng1));
  return 6371 * Math.acos(Math.min(1, Math.max(-1, cosine)));
}
