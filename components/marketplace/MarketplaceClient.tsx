"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ListFilter, Search } from "lucide-react";
import { SEARCH_DEFAULT_RADIUS_KM } from "@/lib/catalog/categories";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { marketplaceApiRepository } from "@/lib/marketplace/api-repository";
import { validateMarketplaceFilters } from "@/lib/marketplace/query";
import type { MarketplaceFilterValue } from "@/lib/marketplace/types";
import { MarketplaceStoreProvider, useMarketplaceStore } from "@/store/marketplace-provider";
import MarketplaceFilters from "./MarketplaceFilters";
import MarketplaceMobileFilterDrawer from "./MarketplaceMobileFilterDrawer";
import MarketplaceResults from "./MarketplaceResults";
import MarketplaceRadiusMapClient from "./MarketplaceRadiusMapClient";

const PAGE_SIZE = 12 as const;

export default function MarketplaceClient() {
  return (
    <MarketplaceStoreProvider>
      <MarketplaceController />
    </MarketplaceStoreProvider>
  );
}

function MarketplaceController() {
  const draftQuery = useMarketplaceStore((state) => state.draftQuery);
  const debouncedQuery = useMarketplaceStore((state) => state.debouncedQuery);
  const selectedCategories = useMarketplaceStore((state) => state.selectedCategories);
  const minPrice = useMarketplaceStore((state) => state.minPrice);
  const maxPrice = useMarketplaceStore((state) => state.maxPrice);
  const radiusKm = useMarketplaceStore((state) => state.radiusKm);
  const currentPage = useMarketplaceStore((state) => state.currentPage);
  const drawerFilters = useMarketplaceStore((state) => state.drawerFilters);
  const isFilterDrawerOpen = useMarketplaceStore((state) => state.isFilterDrawerOpen);
  const items = useMarketplaceStore((state) => state.items);
  const origin = useMarketplaceStore((state) => state.origin);
  const total = useMarketplaceStore((state) => state.total);
  const totalPages = useMarketplaceStore((state) => state.totalPages);
  const loading = useMarketplaceStore((state) => state.loading);
  const error = useMarketplaceStore((state) => state.error);
  const retryRevision = useMarketplaceStore((state) => state.retryRevision);
  const setDraftQuery = useMarketplaceStore((state) => state.setDraftQuery);
  const setDebouncedQuery = useMarketplaceStore((state) => state.setDebouncedQuery);
  const toggleCategory = useMarketplaceStore((state) => state.toggleCategory);
  const setMinPrice = useMarketplaceStore((state) => state.setMinPrice);
  const setMaxPrice = useMarketplaceStore((state) => state.setMaxPrice);
  const setRadiusKm = useMarketplaceStore((state) => state.setRadiusKm);
  const setPage = useMarketplaceStore((state) => state.setPage);
  const openFilterDrawer = useMarketplaceStore((state) => state.openFilterDrawer);
  const closeFilterDrawer = useMarketplaceStore((state) => state.closeFilterDrawer);
  const updateDrawerFilters = useMarketplaceStore((state) => state.updateDrawerFilters);
  const resetDrawerFilters = useMarketplaceStore((state) => state.resetDrawerFilters);
  const applyDrawerFilters = useMarketplaceStore((state) => state.applyDrawerFilters);
  const resetAllFilters = useMarketplaceStore((state) => state.resetAllFilters);
  const retry = useMarketplaceStore((state) => state.retry);
  const beginRequest = useMarketplaceStore((state) => state.beginRequest);
  const blockRequest = useMarketplaceStore((state) => state.blockRequest);
  const resolveRequest = useMarketplaceStore((state) => state.resolveRequest);
  const rejectRequest = useMarketplaceStore((state) => state.rejectRequest);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  const filters = useMemo(
    () => ({ selectedCategories, minPrice, maxPrice, radiusKm }),
    [selectedCategories, minPrice, maxPrice, radiusKm],
  );
  const debouncedValue = useDebouncedValue(draftQuery, 400);
  const appliedRadiusKm = useDebouncedValue(radiusKm, 400);
  const requestFilters = useMemo(
    () => ({ selectedCategories, minPrice, maxPrice, radiusKm: appliedRadiusKm }),
    [selectedCategories, minPrice, maxPrice, appliedRadiusKm],
  );
  const appliedErrors = useMemo(
    () => validateMarketplaceFilters(requestFilters),
    [requestFilters],
  );
  const drawerErrors = useMemo(() => validateMarketplaceFilters(drawerFilters), [drawerFilters]);
  const hasActiveFilters =
    draftQuery.trim() !== "" ||
    selectedCategories.length > 0 ||
    minPrice !== null ||
    maxPrice !== null ||
    radiusKm !== SEARCH_DEFAULT_RADIUS_KM;

  useEffect(() => {
    setDebouncedQuery(debouncedValue.trim());
  }, [debouncedValue, setDebouncedQuery]);

  useEffect(() => {
    const validationErrors = validateMarketplaceFilters(requestFilters);
    if (Object.keys(validationErrors).length > 0) {
      blockRequest();
      return;
    }

    const controller = new AbortController();
    const requestId = beginRequest();
    void marketplaceApiRepository
      .search(
        { query: debouncedQuery, ...requestFilters, page: currentPage, pageSize: PAGE_SIZE },
        { signal: controller.signal },
      )
      .then((result) => resolveRequest(requestId, result))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        rejectRequest(
          requestId,
          reason instanceof Error ? reason.message : "Gagal memuat penawaran.",
        );
      });
    return () => controller.abort();
  }, [
    debouncedQuery,
    requestFilters,
    currentPage,
    retryRevision,
    beginRequest,
    blockRequest,
    resolveRequest,
    rejectRequest,
  ]);

  const updateAppliedFilters = useCallback(
    (nextValue: MarketplaceFilterValue) => {
      const nextCategories = nextValue.selectedCategories;
      selectedCategories
        .filter((category) => !nextCategories.includes(category))
        .forEach((category) => toggleCategory(category));
      nextCategories
        .filter((category) => !selectedCategories.includes(category))
        .forEach((category) => toggleCategory(category));
      if (nextValue.minPrice !== minPrice) setMinPrice(nextValue.minPrice);
      if (nextValue.maxPrice !== maxPrice) setMaxPrice(nextValue.maxPrice);
      if (nextValue.radiusKm !== radiusKm) setRadiusKm(nextValue.radiusKm);
    },
    [
      maxPrice,
      minPrice,
      radiusKm,
      selectedCategories,
      setMaxPrice,
      setMinPrice,
      setRadiusKm,
      toggleCategory,
    ],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setPage(page);
      resultHeadingRef.current?.focus();
    },
    [setPage],
  );

  return (
    <div className="bg-transparent font-sans">
      <div className="flex flex-col gap-4">
        <div className="flex items-stretch gap-3">
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search
                aria-hidden="true"
                className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors"
              />
            </div>
            <label htmlFor="marketplace-search" className="sr-only">
              Cari penawaran marketplace
            </label>
            <input
              id="marketplace-search"
              type="search"
              value={draftQuery}
              maxLength={120}
              onChange={(event) => setDraftQuery(event.target.value)}
              className="block w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
              placeholder="Cari produk UMKM terdekat..."
            />
          </div>
          <button
            type="button"
            onClick={openFilterDrawer}
            className="lg:hidden inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            aria-label="Buka filter pencarian"
          >
            <ListFilter aria-hidden="true" className="w-4 h-4" />
            Filter
          </button>
        </div>

        {origin ? (
          <MarketplaceRadiusMapClient origin={origin} items={items} radiusKm={radiusKm} />
        ) : null}

        <div className="flex items-start gap-6">
          <aside className="hidden lg:flex flex-col w-[280px] shrink-0 bg-white border border-slate-200 rounded-2xl lg:sticky lg:top-20">
            <MarketplaceFilters
              idPrefix="desktop"
              value={filters}
              errors={appliedErrors}
              onChange={updateAppliedFilters}
            />
          </aside>
          <main className="flex-1 w-full min-w-0">
            <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 md:p-6 lg:p-8 shadow-sm">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2
                    ref={resultHeadingRef}
                    tabIndex={-1}
                    className="text-xl font-bold text-slate-800 focus:outline-none"
                  >
                    Penawaran marketplace
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {total} penawaran ditemukan
                  </p>
                </div>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Reset filter
                  </button>
                ) : null}
              </div>
              <MarketplaceResults
                items={items}
                total={total}
                loading={loading}
                error={error}
                hasActiveFilters={hasActiveFilters}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onRetry={retry}
                onReset={resetAllFilters}
              />
            </div>
          </main>
        </div>
      </div>

      <MarketplaceMobileFilterDrawer
        open={isFilterDrawerOpen}
        value={drawerFilters}
        errors={drawerErrors}
        onChange={updateDrawerFilters}
        onApply={applyDrawerFilters}
        onReset={resetDrawerFilters}
        onClose={closeFilterDrawer}
      />
    </div>
  );
}
