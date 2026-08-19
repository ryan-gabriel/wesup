"use client";

import dynamic from "next/dynamic";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";

const SupplierLocationMap = dynamic(() => import("./SupplierLocationMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50/60 sm:h-80" role="status">
      <div className="flex items-center gap-3 text-sm font-medium text-blue-800">
        <span className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
        Menyiapkan peta interaktif…
      </div>
    </div>
  ),
});

export function SupplierLocationMapClient({
  value,
  onChange,
  error,
  disabled,
}: {
  value: MapCoordinate | null;
  onChange: (coordinate: MapCoordinate) => void;
  error?: string;
  disabled?: boolean;
}) {
  return <SupplierLocationMap value={value} onChange={onChange} error={error} disabled={disabled} />;
}
