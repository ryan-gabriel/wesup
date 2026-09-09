import type { BatchCategory } from "@/lib/catalog/categories";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: "Minggu",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
};

export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  0: "Min",
  1: "Sen",
  2: "Sel",
  3: "Rab",
  4: "Kam",
  5: "Jum",
  6: "Sab",
};

export interface RecurringConfig {
  id: string;
  supplierId: string;
  name: string;
  intervalDays: number;
  daysOfWeek: DayOfWeek[];
  isActive: boolean;
  lastGeneratedAt: string | null;
  nextGenerationAt: string | null;
  templateBatch: RecurringBatchTemplate;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringBatchTemplate {
  title: string;
  category: BatchCategory;
  description: string;
  tiers: readonly RecurringTierTemplate[];
  pickupName: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
}

export interface RecurringTierTemplate {
  tierNumber: number;
  minimumQuantity: number;
  maximumQuantity: number | null;
  pricePerUnit: number;
}

export interface RecurringBatchPreview {
  configId: string;
  configName: string;
  templateTitle: string;
  category: BatchCategory;
  estimatedRegistrationOpensAt: string;
  estimatedRegistrationClosesAt: string;
  estimatedPaymentOpensAt: string;
  estimatedPaymentClosesAt: string;
  estimatedReadyAt: string;
  tiers: readonly RecurringTierTemplate[];
  pickupName: string;
  pickupAddress: string;
}

export interface RecurringOptionDraft {
  enabled: boolean;
  name: string;
  intervalDays: number;
  daysOfWeek: DayOfWeek[];
}

export type RecurringConfigDraft = {
  name: string;
  intervalDays: number;
  daysOfWeek: DayOfWeek[];
  isActive: boolean;
  templateTitle: string;
  templateCategory: BatchCategory | "";
  templateDescription: string;
  templateTiers: RecurringTierTemplate[];
  templatePickupName: string;
  templatePickupAddress: string;
  templatePickupLatitude: number | null;
  templatePickupLongitude: number | null;
};

export const INITIAL_RECURRING_DRAFT: RecurringConfigDraft = {
  name: "",
  intervalDays: 7,
  daysOfWeek: [],
  isActive: true,
  templateTitle: "",
  templateCategory: "",
  templateDescription: "",
  templateTiers: [
    { tierNumber: 1, minimumQuantity: 1, maximumQuantity: 24, pricePerUnit: 0 },
    { tierNumber: 2, minimumQuantity: 25, maximumQuantity: 49, pricePerUnit: 0 },
  ],
  templatePickupName: "",
  templatePickupAddress: "",
  templatePickupLatitude: null,
  templatePickupLongitude: null,
};

export type RecurringDraftStep = 1 | 2 | 3;

export interface RecurringStepDefinition {
  id: RecurringDraftStep;
  label: string;
  shortLabel: string;
}

export const RECURRING_STEPS: readonly RecurringStepDefinition[] = [
  { id: 1, label: "Jadwal & Interval", shortLabel: "Jadwal" },
  { id: 2, label: "Template Batch", shortLabel: "Template" },
  { id: 3, label: "Tinjauan", shortLabel: "Review" },
] as const;

export type FieldErrors = Partial<
  Record<
    | keyof RecurringConfigDraft
    | `templateTiers.${number}.pricePerUnit`
    | `templateTiers.${number}.minimumQuantity`
    | `templateTiers.${number}.maximumQuantity`
    | "templateTierOverlap"
    | "templateTierInversion"
    | "daysOfWeek"
    | "templateCoordinate",
    string
  >
>;
