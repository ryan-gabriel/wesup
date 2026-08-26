import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPaginationItems } from "@/lib/marketplace/query";

export interface MarketplacePaginationProps { currentPage: number; totalPages: number; disabled?: boolean; onPageChange: (page: number) => void; }

export default function MarketplacePagination({ currentPage, totalPages, disabled = false, onPageChange }: MarketplacePaginationProps) {
  const previousDisabled = disabled || currentPage <= 1;
  const nextDisabled = disabled || currentPage >= totalPages;
  return (
    <div className="flex items-center justify-center w-full mt-8 mb-4">
      <nav className="flex items-center gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200 shadow-sm" aria-label="Pagination Navigation">
        <button type="button" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-500 bg-transparent rounded-lg hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" disabled={previousDisabled} onClick={() => onPageChange(currentPage - 1)}><ChevronLeft aria-hidden="true" className="w-4 h-4 flex-shrink-0" /><span>Prev</span></button>
        <div className="hidden sm:flex items-center gap-1.5 px-2">
          {getPaginationItems(currentPage, totalPages).map((page, index) => page === "ellipsis" ? <span key={`ellipsis-${index}`} aria-hidden="true" className="flex items-center justify-center w-8 h-10 text-slate-400 font-medium">...</span> : <button key={page} type="button" aria-label={`Halaman ${page}`} aria-current={page === currentPage ? "page" : undefined} disabled={disabled} onClick={() => onPageChange(page)} className={page === currentPage ? "w-10 h-10 flex items-center justify-center text-sm font-bold text-white bg-blue-600 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed" : "w-10 h-10 flex items-center justify-center text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"}>{page}</button>)}
        </div>
        <button type="button" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-transparent rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" disabled={nextDisabled} onClick={() => onPageChange(currentPage + 1)}><ChevronRight aria-hidden="true" className="w-4 h-4 flex-shrink-0" /><span>Next</span></button>
      </nav>
    </div>
  );
}
