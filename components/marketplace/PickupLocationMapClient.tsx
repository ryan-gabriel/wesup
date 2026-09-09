"use client";

import dynamic from "next/dynamic";
import type { PickupLocationMapProps } from "./PickupLocationMap";

const PickupLocationMap = dynamic(() => import("./PickupLocationMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[260px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50"
      role="status"
    >
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <span className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
        Memuat peta lokasi…
      </div>
    </div>
  ),
});

export default function PickupLocationMapClient(props: PickupLocationMapProps) {
  return <PickupLocationMap {...props} />;
}
