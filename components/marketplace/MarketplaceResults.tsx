import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import type { MarketplaceItem } from "@/lib/marketplace/types";
import MarketplaceEmptyState from "./MarketplaceEmptyState";
import MarketplacePagination from "./MarketplacePagination";
import ProductCard from "./ProductCard";
import ProductSkeleton from "./ProductSkeleton";

export interface MarketplaceResultsProps {
  items: readonly MarketplaceItem[];
  total: number;
  loading: boolean;
  error: string | null;
  hasActiveFilters: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onReset: () => void;
}

export default function MarketplaceResults({ items, total, loading, error, hasActiveFilters, currentPage, totalPages, onPageChange, onRetry, onReset }: MarketplaceResultsProps) {
  const liveMessage = loading ? "Memuat penawaran..." : error !== null ? `Gagal memuat penawaran: ${error}` : items.length === 0 ? "Tidak ada penawaran yang ditemukan." : `${total} penawaran ditemukan.`;
  let content: ReactNode;
  if (loading) {
    content = <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <ProductSkeleton key={index} />)}</div>;
  } else if (error !== null) {
    content = <div role="alert" className="flex flex-col items-center justify-center min-h-[400px] w-full bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center"><AlertCircle aria-hidden="true" className="w-14 h-14 text-red-400 mb-5" /><h3 className="text-xl font-bold text-slate-800 mb-2">Penawaran belum bisa dimuat</h3><p className="text-sm font-medium text-slate-500 max-w-sm">{error}</p><button type="button" onClick={onRetry} className="flex items-center gap-2 mt-6 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"><RefreshCw aria-hidden="true" className="w-4 h-4 flex-shrink-0" /><span>Coba lagi</span></button></div>;
  } else if (items.length === 0) {
    content = <MarketplaceEmptyState hasActiveFilters={hasActiveFilters} onReset={onReset} />;
  } else {
    content = <><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">{items.map((item) => <ProductCard key={item.id} item={item} />)}</div>{totalPages > 1 && <MarketplacePagination currentPage={currentPage} totalPages={totalPages} disabled={loading} onPageChange={onPageChange} />}</>;
  }
  return <section aria-label="Hasil Penawaran Marketplace" aria-busy={loading} aria-describedby="marketplace-results-status"><p id="marketplace-results-status" className="sr-only" aria-live="polite">{liveMessage}</p>{content}</section>;
}
