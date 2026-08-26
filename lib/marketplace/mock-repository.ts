import { SEARCH_DEFAULT_LIMIT } from "@/lib/catalog/categories";
import { filterMarketplaceItems, paginateMarketplaceItems } from "./query";
import { marketplaceMockItems } from "./mock-data";
import type { MarketplaceMockScenario, MarketplaceRepository, MarketplaceSearchResult } from "./types";

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function cloneSearchResult(result: MarketplaceSearchResult): MarketplaceSearchResult {
  return {
    ...result,
    items: result.items.map((item) => ({ ...item })),
  };
}

export function createMarketplaceMockRepository(options: {
  items?: readonly import("./types").MarketplaceItem[];
  latencyMs?: number;
  scenario?: MarketplaceMockScenario;
} = {}): MarketplaceRepository {
  const items = options.items ?? marketplaceMockItems;
  const latencyMs = Math.max(0, options.latencyMs ?? 250);
  const scenario = options.scenario ?? "success";
  return {
    search(criteria, { signal } = {}) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(abortError());
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener("abort", onAbort);
          if (scenario === "error") return reject(new Error("Gagal memuat penawaran mock."));
          if (scenario === "empty") return resolve(cloneSearchResult(paginateMarketplaceItems([], criteria.page, SEARCH_DEFAULT_LIMIT)));
          const filtered = filterMarketplaceItems(items, criteria);
          resolve(cloneSearchResult(paginateMarketplaceItems(filtered, criteria.page, criteria.pageSize)));
        };
        const timer = setTimeout(finish, latencyMs);
        const onAbort = () => {
          clearTimeout(timer);
          if (!settled) { settled = true; reject(abortError()); }
        };
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    },
  };
}

export const marketplaceMockRepository = createMarketplaceMockRepository();
