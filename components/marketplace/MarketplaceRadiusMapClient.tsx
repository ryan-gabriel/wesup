"use client";

import dynamic from "next/dynamic";
import type { MarketplaceRadiusMapProps } from "./MarketplaceRadiusMap";

const MarketplaceRadiusMap = dynamic(() => import("./MarketplaceRadiusMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 md:h-[380px]"
      role="status"
    >
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <span className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
        Memuat peta radius…
      </div>
    </div>
  ),
});

export default function MarketplaceRadiusMapClient(props: MarketplaceRadiusMapProps) {
  return <MarketplaceRadiusMap {...props} />;
}
