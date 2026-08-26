"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { validateMarketplaceFilters, type MarketplaceFilterErrors } from "@/lib/marketplace/query";
import type { MarketplaceFilterValue } from "@/lib/marketplace/types";
import MarketplaceFilters from "./MarketplaceFilters";

export interface MarketplaceMobileFilterDrawerProps {
  open: boolean;
  value: MarketplaceFilterValue;
  errors: MarketplaceFilterErrors;
  onChange: (value: MarketplaceFilterValue) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}

export default function MarketplaceMobileFilterDrawer({ open, value, errors, onChange, onApply, onReset, onClose }: MarketplaceMobileFilterDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const applyDisabled = Object.keys(validateMarketplaceFilters(value)).length > 0;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);
  const restoreFocus = () => openerRef.current?.focus();

  return (
    <dialog ref={dialogRef} id="marketplace-mobile-filter-drawer" aria-labelledby="marketplace-mobile-filter-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClose={restoreFocus} className="m-0 ml-auto h-full max-h-none w-full max-w-sm bg-white p-0 shadow-2xl backdrop:bg-slate-900/40 md:hidden">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4"><h2 id="marketplace-mobile-filter-title" className="text-lg font-bold text-slate-800">Filter Pencarian</h2><button type="button" onClick={onClose} className="flex items-center gap-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"><X aria-hidden="true" className="h-5 w-5 flex-shrink-0" /><span className="sr-only">Tutup filter</span></button></div>
        <div className="flex-1 overflow-y-auto"><MarketplaceFilters idPrefix="mobile" value={value} errors={errors} onChange={onChange} /></div>
        <div className="grid grid-cols-3 gap-3 border-t border-slate-200 bg-white px-4 py-4"><button type="button" onClick={onReset} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Reset</button><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Batal</button><button type="button" disabled={applyDisabled} onClick={onApply} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-40">Terapkan</button></div>
      </div>
    </dialog>
  );
}
