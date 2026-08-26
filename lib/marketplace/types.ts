import type { BatchCategory } from "@/lib/catalog/categories";

export type MarketplaceItemStatus = "ACTIVE" | "CLOSED" | "CANCELLED_BY_SUPPLIER";

export interface MarketplaceItem {
  id: string;
  slug: string;
  title: string;
  supplierName: string;
  category: BatchCategory;
  imageUrl: string;
  distanceKm: number;
  estimatedPickupMinutes: number;
  basePrice: number;
  currentTierPrice: number;
  registeredQuantity: number;
  targetQuantity: number;
  status: MarketplaceItemStatus;
  registrationClosesAt: string;
}

export interface MarketplaceFilterValue {
  query?: string;
  selectedCategories: readonly BatchCategory[];
  minPrice: number | null;
  maxPrice: number | null;
  radiusKm: number;
}

export interface MarketplaceSearchCriteria extends MarketplaceFilterValue {
  page: number;
  pageSize: 12;
}

export interface MarketplaceSearchResult {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: 12;
  totalPages: number;
}

export type MarketplaceMockScenario = "success" | "empty" | "error";

export interface MarketplaceRepository {
  search(criteria: MarketplaceSearchCriteria, options?: { signal?: AbortSignal }): Promise<MarketplaceSearchResult>;
}
