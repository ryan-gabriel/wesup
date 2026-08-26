"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  createMarketplaceStore,
  type MarketplaceStoreApi,
  type MarketplaceStoreState,
} from "@/store/marketplace";

const MarketplaceStoreContext = createContext<MarketplaceStoreApi | null>(null);

export function MarketplaceStoreProvider({ children }: { children: ReactNode }): ReactNode {
  const [store] = useState(createMarketplaceStore);
  return <MarketplaceStoreContext.Provider value={store}>{children}</MarketplaceStoreContext.Provider>;
}

export function useMarketplaceStore<T>(selector: (state: MarketplaceStoreState) => T): T {
  const store = useContext(MarketplaceStoreContext);
  if (store === null) throw new Error("useMarketplaceStore must be used within MarketplaceStoreProvider");
  return useStore(store, selector);
}
