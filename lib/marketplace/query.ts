import {
  SEARCH_MAX_RADIUS_KM,
  SEARCH_MIN_RADIUS_KM,
} from "@/lib/catalog/categories";
import type {
  MarketplaceFilterValue,
  MarketplaceItem,
  MarketplaceSearchCriteria,
  MarketplaceSearchResult,
} from "./types";

export interface MarketplaceFilterErrors {
  minPrice?: string;
  maxPrice?: string;
  priceRange?: string;
  radiusKm?: string;
}

export function validateMarketplaceFilters(value: MarketplaceFilterValue): MarketplaceFilterErrors {
  const errors: MarketplaceFilterErrors = {};
  if (value.minPrice !== null && value.minPrice < 0) errors.minPrice = "Harga minimum tidak boleh negatif.";
  if (value.maxPrice !== null && value.maxPrice < 0) errors.maxPrice = "Harga maksimum tidak boleh negatif.";
  if (value.minPrice !== null && value.maxPrice !== null && value.minPrice > value.maxPrice) {
    errors.priceRange = "Harga minimum tidak boleh lebih besar dari harga maksimum.";
  }
  if (value.radiusKm < SEARCH_MIN_RADIUS_KM || value.radiusKm > SEARCH_MAX_RADIUS_KM) {
    errors.radiusKm = "Radius harus antara 1 dan 50 km.";
  }
  return errors;
}

export function filterMarketplaceItems(
  items: readonly MarketplaceItem[],
  criteria: Omit<MarketplaceSearchCriteria, "page" | "pageSize">,
): MarketplaceItem[] {
  const needle = (criteria.query ?? "").trim().toLocaleLowerCase("id-ID");
  return items.filter((item) => {
    const searchable = `${item.title} ${item.supplierName} ${item.category}`.toLocaleLowerCase("id-ID");
    return item.status === "ACTIVE"
      && (needle === "" || searchable.includes(needle))
      && (criteria.selectedCategories.length === 0 || criteria.selectedCategories.includes(item.category))
      && (criteria.minPrice === null || item.currentTierPrice >= criteria.minPrice)
      && (criteria.maxPrice === null || item.currentTierPrice <= criteria.maxPrice)
      && item.distanceKm !== null
      && item.distanceKm <= criteria.radiusKm;
  });
}

export function paginateMarketplaceItems(
  items: readonly MarketplaceItem[],
  requestedPage: number,
  pageSize: 12 = 12,
): MarketplaceSearchResult {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const page = totalPages === 0 ? 1 : Math.min(Math.max(1, requestedPage), totalPages);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages };
}

export function getPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 0) return [];
  const page = Math.min(Math.max(1, currentPage), totalPages);
  const nearby = page <= 2
    ? [1, 2, 3]
    : page >= totalPages - 1
      ? [totalPages - 2, totalPages - 1, totalPages]
      : [page - 1, page, page + 1];
  const pages = new Set<number>([1, totalPages, ...nearby]);
  const ordered = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  ordered.forEach((value, index) => {
    if (index > 0 && value - ordered[index - 1] > 1) result.push("ellipsis");
    result.push(value);
  });
  return result;
}
