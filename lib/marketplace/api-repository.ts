import type {
  MarketplaceRepository,
  MarketplaceSearchCriteria,
  MarketplaceSearchResponse,
} from "./types";

export async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim() !== "") {
      return body.error;
    }
  } catch {
    // Fall through to the status text when the response is not JSON.
  }
  return response.statusText || `Request failed (${response.status})`;
}

export const marketplaceApiRepository: MarketplaceRepository = {
  async search(
    criteria: MarketplaceSearchCriteria,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<MarketplaceSearchResponse> {
    const params = new URLSearchParams({
      q: criteria.query ?? "",
      radius: String(criteria.radiusKm),
      page: String(criteria.page),
      limit: String(criteria.pageSize),
    });
    if (criteria.selectedCategories.length > 0) {
      params.set("categories", criteria.selectedCategories.join(","));
    }
    if (criteria.minPrice !== null) params.set("minPrice", String(criteria.minPrice));
    if (criteria.maxPrice !== null) params.set("maxPrice", String(criteria.maxPrice));

    const response = await fetch(`/api/marketplace/search?${params.toString()}`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await readApiError(response));
    return (await response.json()) as MarketplaceSearchResponse;
  },
};
