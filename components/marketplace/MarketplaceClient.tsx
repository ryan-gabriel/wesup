"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Menu, Search } from "lucide-react";
import { SEARCH_DEFAULT_RADIUS_KM } from "@/lib/catalog/categories";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { marketplaceMockRepository } from "@/lib/marketplace/mock-repository";
import { validateMarketplaceFilters } from "@/lib/marketplace/query";
import type { MarketplaceFilterValue } from "@/lib/marketplace/types";
import { MarketplaceStoreProvider, useMarketplaceStore } from "@/store/marketplace-provider";
import MarketplaceFilters from "./MarketplaceFilters";
import MarketplaceMobileFilterDrawer from "./MarketplaceMobileFilterDrawer";
import MarketplaceResults from "./MarketplaceResults";

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

  const filters = useMemo(() => ({ selectedCategories, minPrice, maxPrice, radiusKm }), [selectedCategories, minPrice, maxPrice, radiusKm]);
  const debouncedValue = useDebouncedValue(draftQuery, 400);
  const appliedErrors = useMemo(() => validateMarketplaceFilters(filters), [filters]);
  const drawerErrors = useMemo(() => validateMarketplaceFilters(drawerFilters), [drawerFilters]);
  const hasActiveFilters = draftQuery.trim() !== "" || selectedCategories.length > 0 || minPrice !== null || maxPrice !== null || radiusKm !== SEARCH_DEFAULT_RADIUS_KM;

  useEffect(() => {
    setDebouncedQuery(debouncedValue.trim());
  }, [debouncedValue, setDebouncedQuery]);

  useEffect(() => {
    const validationErrors = validateMarketplaceFilters(filters);
    if (Object.keys(validationErrors).length > 0) {
      blockRequest();
      return;
    }

    const controller = new AbortController();
    const requestId = beginRequest();
    void marketplaceMockRepository
      .search({ query: debouncedQuery, ...filters, page: currentPage, pageSize: PAGE_SIZE }, { signal: controller.signal })
      .then((result) => resolveRequest(requestId, result))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        rejectRequest(requestId, reason instanceof Error ? reason.message : "Gagal memuat penawaran mock.");
      });
    return () => controller.abort();
  }, [debouncedQuery, filters, currentPage, retryRevision, beginRequest, blockRequest, resolveRequest, rejectRequest]);

  const updateAppliedFilters = useCallback((nextValue: MarketplaceFilterValue) => {
    const nextCategories = nextValue.selectedCategories;
    selectedCategories.filter((category) => !nextCategories.includes(category)).forEach((category) => toggleCategory(category));
    nextCategories.filter((category) => !selectedCategories.includes(category)).forEach((category) => toggleCategory(category));
    if (nextValue.minPrice !== minPrice) setMinPrice(nextValue.minPrice);
    if (nextValue.maxPrice !== maxPrice) setMaxPrice(nextValue.maxPrice);
    if (nextValue.radiusKm !== radiusKm) setRadiusKm(nextValue.radiusKm);
  }, [maxPrice, minPrice, radiusKm, selectedCategories, setMaxPrice, setMinPrice, setRadiusKm, toggleCategory]);

  const handlePageChange = useCallback((page: number) => {
    setPage(page);
    resultHeadingRef.current?.focus();
  }, [setPage]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-sm h-16">
        <div className="max-w-[1440px] mx-auto w-full h-full px-4 md:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={openFilterDrawer} className="md:hidden flex items-center gap-2 p-2 -ml-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors" aria-label="Buka filter pencarian">
              <Menu aria-hidden="true" className="w-5 h-5 flex-shrink-0" />
            </button>
            <div className="hidden md:flex items-center font-bold text-xl text-slate-800">Wesup</div>
          </div>
          <div className="flex-1 max-w-2xl mx-auto w-full relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Search aria-hidden="true" className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" /></div>
            <label htmlFor="marketplace-search" className="sr-only">Cari penawaran marketplace</label>
            <input id="marketplace-search" type="search" value={draftQuery} maxLength={120} onChange={(event) => setDraftQuery(event.target.value)} className="block w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all shadow-inner" placeholder="Cari produk UMKM terdekat..." />
          </div>
          <div className="w-8 md:w-16" />
        </div>
      </header>

      <div className="flex-1 max-w-[1440px] mx-auto w-full flex items-start overflow-hidden relative">
        <aside className="hidden md:flex flex-col w-[280px] lg:w-[320px] flex-shrink-0 bg-white border-r border-slate-200 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
          <MarketplaceFilters idPrefix="desktop" value={filters} errors={appliedErrors} onChange={updateAppliedFilters} />
        </aside>
        <main className="flex-1 w-full h-[calc(100vh-4rem)] p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="w-full min-h-full bg-white border-2 border-dashed border-slate-200 rounded-2xl p-4 md:p-6 lg:p-8 transition-colors hover:border-slate-300 hover:bg-slate-50/50">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 ref={resultHeadingRef} tabIndex={-1} className="text-xl font-bold text-slate-800 focus:outline-none">Penawaran marketplace</h1>
                <p className="mt-1 text-sm font-medium text-slate-500">{total} penawaran ditemukan</p>
              </div>
              {hasActiveFilters ? <button type="button" onClick={resetAllFilters} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Reset filter</button> : null}
            </div>
            <MarketplaceResults items={items} total={total} loading={loading} error={error} hasActiveFilters={hasActiveFilters} currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} onRetry={retry} onReset={resetAllFilters} />
          </div>
        </main>
      </div>

      <MarketplaceMobileFilterDrawer open={isFilterDrawerOpen} value={drawerFilters} errors={drawerErrors} onChange={updateDrawerFilters} onApply={applyDrawerFilters} onReset={resetDrawerFilters} onClose={closeFilterDrawer} />
    </div>
  );
}
