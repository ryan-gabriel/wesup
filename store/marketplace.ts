import { SEARCH_DEFAULT_RADIUS_KM, SEARCH_MAX_RADIUS_KM, SEARCH_MIN_RADIUS_KM } from "@/lib/catalog/categories";
import type { BatchCategory } from "@/lib/catalog/categories";
import type { MarketplaceFilterValue, MarketplaceItem, MarketplaceSearchResult } from "@/lib/marketplace/types";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface MarketplaceStoreState {
  draftQuery: string;
  debouncedQuery: string;
  selectedCategories: BatchCategory[];
  minPrice: number | null;
  maxPrice: number | null;
  radiusKm: number;
  currentPage: number;
  isFilterDrawerOpen: boolean;
  drawerFilters: MarketplaceFilterValue;
  items: MarketplaceItem[];
  total: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  activeRequestId: number;
  retryRevision: number;
  setDraftQuery(value: string): void;
  setDebouncedQuery(value: string): void;
  toggleCategory(category: BatchCategory): void;
  setMinPrice(value: number | null): void;
  setMaxPrice(value: number | null): void;
  setRadiusKm(value: number): void;
  setPage(page: number): void;
  openFilterDrawer(): void;
  closeFilterDrawer(): void;
  updateDrawerFilters(value: MarketplaceFilterValue): void;
  resetDrawerFilters(): void;
  applyDrawerFilters(): void;
  resetAllFilters(): void;
  retry(): void;
  beginRequest(): number;
  blockRequest(): void;
  resolveRequest(requestId: number, result: MarketplaceSearchResult): void;
  rejectRequest(requestId: number, message: string): void;
}

export type MarketplaceStoreApi = StoreApi<MarketplaceStoreState>;

function createDefaultFilters(): MarketplaceFilterValue {
  return {
    selectedCategories: [],
    minPrice: null,
    maxPrice: null,
    radiusKm: SEARCH_DEFAULT_RADIUS_KM,
  };
}

function clampRadiusKm(value: number): number {
  return Math.min(Math.max(value, SEARCH_MIN_RADIUS_KM), SEARCH_MAX_RADIUS_KM);
}

export function createMarketplaceStore(): MarketplaceStoreApi {
  return createStore<MarketplaceStoreState>()((set, get) => ({
    draftQuery: "",
    debouncedQuery: "",
    selectedCategories: [],
    minPrice: null,
    maxPrice: null,
    radiusKm: SEARCH_DEFAULT_RADIUS_KM,
    currentPage: 1,
    isFilterDrawerOpen: false,
    drawerFilters: createDefaultFilters(),
    items: [],
    total: 0,
    totalPages: 0,
    loading: false,
    error: null,
    activeRequestId: 0,
    retryRevision: 0,
    setDraftQuery: (value) => set({ draftQuery: value }),
    setDebouncedQuery: (value) => set({ debouncedQuery: value, currentPage: 1 }),
    toggleCategory: (category) => set((state) => ({
      selectedCategories: state.selectedCategories.includes(category)
        ? state.selectedCategories.filter((value) => value !== category)
        : [...state.selectedCategories, category],
      currentPage: 1,
    })),
    setMinPrice: (value) => set({ minPrice: value, currentPage: 1 }),
    setMaxPrice: (value) => set({ maxPrice: value, currentPage: 1 }),
    setRadiusKm: (value) => set({ radiusKm: clampRadiusKm(value), currentPage: 1 }),
    setPage: (page) => set({ currentPage: Math.max(1, page) }),
    openFilterDrawer: () => {
      const { selectedCategories, minPrice, maxPrice, radiusKm } = get();
      set({
        isFilterDrawerOpen: true,
        drawerFilters: { selectedCategories: [...selectedCategories], minPrice, maxPrice, radiusKm },
      });
    },
    closeFilterDrawer: () => set({ isFilterDrawerOpen: false }),
    updateDrawerFilters: (value) => set({
      drawerFilters: {
        ...value,
        selectedCategories: [...value.selectedCategories],
        radiusKm: clampRadiusKm(value.radiusKm),
      },
    }),
    resetDrawerFilters: () => set({ drawerFilters: createDefaultFilters() }),
    applyDrawerFilters: () => {
      const { drawerFilters } = get();
      set({
        selectedCategories: [...drawerFilters.selectedCategories],
        minPrice: drawerFilters.minPrice,
        maxPrice: drawerFilters.maxPrice,
        radiusKm: clampRadiusKm(drawerFilters.radiusKm),
        currentPage: 1,
        isFilterDrawerOpen: false,
      });
    },
    resetAllFilters: () => set({
      draftQuery: "",
      debouncedQuery: "",
      selectedCategories: [],
      minPrice: null,
      maxPrice: null,
      radiusKm: SEARCH_DEFAULT_RADIUS_KM,
      currentPage: 1,
      drawerFilters: createDefaultFilters(),
    }),
    retry: () => set((state) => ({ error: null, retryRevision: state.retryRevision + 1 })),
    beginRequest: () => {
      const requestId = get().activeRequestId + 1;
      set({ activeRequestId: requestId, loading: true, error: null });
      return requestId;
    },
    blockRequest: () => set((state) => ({ activeRequestId: state.activeRequestId + 1, loading: false })),
    resolveRequest: (requestId, result) => {
      if (requestId !== get().activeRequestId) return;
      set({
        items: result.items,
        currentPage: result.page,
        total: result.total,
        totalPages: result.totalPages,
        loading: false,
        error: null,
      });
    },
    rejectRequest: (requestId, message) => {
      if (requestId !== get().activeRequestId) return;
      set({ loading: false, error: message });
    },
  }));
}
