import type { BatchCategory } from "@/lib/catalog/categories";
import type { RecurringOptionDraft } from "@/lib/supplier-recurring/types";

export type CatalogDraftStep = 1 | 2 | 3 | 4 | 5;

export interface CatalogTierDraft {
  tierNumber: number;
  minimumQuantity: number;
  maximumQuantity: number | null;
  pricePerUnit: number;
}

export interface CatalogDraft {
  title: string;
  category: BatchCategory | "";
  description: string;
  targetQuantity: number;
  productPhoto: File | null;
  productPhotoUrl: string | null;
  tiers: CatalogTierDraft[];
  registrationOpensAt: string;
  registrationClosesAt: string;
  paymentOpensAt: string;
  paymentClosesAt: string;
  estimatedReadyAt: string;
  pickupName: string;
  pickupAddress: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  recurring: RecurringOptionDraft;
}

export const INITIAL_CATALOG_DRAFT: CatalogDraft = {
  title: "",
  category: "",
  description: "",
  targetQuantity: 50,
  productPhoto: null,
  productPhotoUrl: null,
  tiers: [
    { tierNumber: 1, minimumQuantity: 1, maximumQuantity: 24, pricePerUnit: 0 },
    { tierNumber: 2, minimumQuantity: 25, maximumQuantity: 49, pricePerUnit: 0 },
  ],
  registrationOpensAt: "",
  registrationClosesAt: "",
  paymentOpensAt: "",
  paymentClosesAt: "",
  estimatedReadyAt: "",
  pickupName: "",
  pickupAddress: "",
  pickupLatitude: null,
  pickupLongitude: null,
  recurring: {
    enabled: false,
    name: "",
    intervalDays: 7,
    daysOfWeek: [],
  },
};

export type FieldErrors = Partial<
  Record<
    | keyof CatalogDraft
    | `tiers.${number}.${"minimumQuantity" | "maximumQuantity" | "pricePerUnit"}`
    | "tierOverlap"
    | "tierInversion"
    | "timelineOrder"
    | "pickupCoordinate",
    string
  >
>;

export interface CatalogStepDefinition {
  id: CatalogDraftStep;
  label: string;
  shortLabel: string;
}

export const CATALOG_STEPS: readonly CatalogStepDefinition[] = [
  { id: 1, label: "Detail Produk", shortLabel: "Produk" },
  { id: 2, label: "Harga Tier", shortLabel: "Harga" },
  { id: 3, label: "Timeline", shortLabel: "Waktu" },
  { id: 4, label: "Lokasi & Foto", shortLabel: "Lokasi" },
  { id: 5, label: "Tinjauan", shortLabel: "Review" },
] as const;
