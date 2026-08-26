import { PackageX, RotateCcw } from "lucide-react";

export interface MarketplaceEmptyStateProps { hasActiveFilters: boolean; onReset: () => void; }

export default function MarketplaceEmptyState({ hasActiveFilters, onReset }: MarketplaceEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center h-full">
      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100"><PackageX aria-hidden="true" className="w-16 h-16 text-slate-300" /></div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">Barang tidak ditemukan</h3>
      <p className="text-sm font-medium text-slate-500 max-w-sm">Coba ubah filter rentang harga, lokasi, atau kategori produk untuk melihat hasil yang berbeda.</p>
      {hasActiveFilters ? <button type="button" onClick={onReset} className="flex items-center gap-2 mt-6 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"><RotateCcw aria-hidden="true" className="w-4 h-4 flex-shrink-0" /><span>Reset filter</span></button> : null}
    </div>
  );
}
