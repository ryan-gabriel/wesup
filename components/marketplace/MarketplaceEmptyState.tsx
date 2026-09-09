import { PackageX, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export interface MarketplaceEmptyStateProps {
  hasActiveFilters: boolean;
  onReset: () => void;
}

export default function MarketplaceEmptyState({
  hasActiveFilters,
  onReset,
}: MarketplaceEmptyStateProps) {
  return (
    <div className="min-h-[400px] w-full rounded-2xl border border-slate-200 bg-white shadow-sm">
      <EmptyState
        illustration={
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-slate-100 bg-slate-50">
            <PackageX aria-hidden="true" className="h-16 w-16 text-slate-300" />
          </div>
        }
        heading="Barang tidak ditemukan"
        description="Coba ubah filter rentang harga, lokasi, atau kategori produk untuk melihat hasil yang berbeda."
        action={
          hasActiveFilters ? (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4 flex-shrink-0" />
              <span>Reset filter</span>
            </button>
          ) : null
        }
      />
    </div>
  );
}
