"use client";

import dynamic from "next/dynamic";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[520px] items-center justify-center rounded-3xl border border-emerald-100 bg-emerald-50/60"
      role="status"
    >
      <div className="flex items-center gap-3 text-sm font-medium text-emerald-800">
        <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
        Menyiapkan peta interaktif…
      </div>
    </div>
  ),
});

export function LeafletDemoClient() {
  return <LeafletMap />;
}
