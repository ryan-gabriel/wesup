"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Package, Plus, Search, SlidersHorizontal } from "lucide-react";
import { supplierCatalogApiRepository } from "@/lib/supplier-catalog/api-repository";
import type { SupplierBatchDetail, SupplierBatchStatus } from "@/lib/supplier-batch/types";
import CatalogCard from "@/components/supplier/catalog/CatalogCard";

type FilterTab = "ALL" | "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED_BY_SUPPLIER";
type LoadPhase = "loading" | "success" | "error";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Aktif" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "CANCELLED_BY_SUPPLIER", label: "Dibatalkan" },
];

const EMPTY_MESSAGES: Record<FilterTab, string> = {
  ALL: "Belum ada katalog. Mulai buat penawaran pertama Anda.",
  DRAFT: "Belum ada katalog draft.",
  PUBLISHED: "Belum ada katalog aktif.",
  COMPLETED: "Belum ada katalog selesai.",
  CANCELLED_BY_SUPPLIER: "Tidak ada katalog yang dibatalkan.",
};

function SkeletonCard() {
  return <div className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="h-36 bg-slate-100" /><div className="space-y-3 p-4"><div className="h-4 w-3/4 rounded bg-slate-100" /><div className="h-3 w-1/3 rounded bg-slate-100" /><div className="h-7 w-1/2 rounded bg-slate-100" /><div className="h-2 rounded bg-slate-100" /></div></div>;
}

export default function CatalogListClient() {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<SupplierBatchDetail[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ ALL: 0 });
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setPhase("loading");
    setError(null);
    try {
      const response = await supplierCatalogApiRepository.list({ query: searchQuery, signal });
      if (!signal.aborted) {
        setItems(response.items);
        setCounts(response.counts);
        setPhase("success");
      }
    } catch (requestError) {
      if (signal.aborted) return;
      setPhase("error");
      setError(requestError instanceof Error ? requestError.message : "Gagal memuat katalog.");
    }
  }, [searchQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, retry]);

  const filteredBatches = useMemo(() => {
    if (activeTab === "ALL") return items;
    return items.filter((batch) => batch.status === activeTab as SupplierBatchStatus);
  }, [activeTab, items]);

  const activeCount = counts[activeTab] ?? 0;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Katalog Saya</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola seluruh penawaran bahan baku Anda.</p>
        </div>
        <Link href="/supplier/catalog/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          <Plus aria-hidden="true" size={18} /> Buat Penawaran
        </Link>
      </section>

      <section className="space-y-3">
        <div className="relative">
          <Search aria-hidden="true" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" placeholder="Cari katalog berdasarkan nama, kode, atau kategori..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" aria-label="Cari katalog" />
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <SlidersHorizontal aria-hidden="true" size={14} className="ml-2 shrink-0 text-slate-400" />
          {FILTER_TABS.map((tab) => (
            <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)} className={activeTab === tab.value ? "flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm sm:flex-none sm:px-4" : "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 sm:flex-none sm:px-4"} aria-pressed={activeTab === tab.value}>
              {tab.label}<span className="ml-1 text-[10px] opacity-70">({counts[tab.value] ?? 0})</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-label="Daftar katalog" aria-busy={phase === "loading"}>
        {phase === "loading" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((key) => <SkeletonCard key={key} />)}</div>
        ) : phase === "error" ? (
          <div className="rounded-xl border border-red-200 bg-white p-10 text-center shadow-sm" role="alert">
            <AlertCircle aria-hidden="true" size={40} className="mx-auto text-red-400" />
            <p className="mt-3 text-sm font-semibold text-slate-800">Katalog belum bisa dimuat</p>
            <p className="mt-1 text-xs text-red-600">{error ?? "Terjadi kesalahan pada server."}</p>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Coba lagi</button>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <Package aria-hidden="true" size={40} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">{searchQuery.trim() ? `Tidak ada katalog yang cocok dengan "${searchQuery}".` : EMPTY_MESSAGES[activeTab]}</p>
            {!searchQuery.trim() && activeTab === "ALL" && <Link href="/supplier/catalog/new" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus aria-hidden="true" size={16} /> Buat Penawaran</Link>}
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">Menampilkan {filteredBatches.length} katalog{searchQuery.trim() && ` untuk "${searchQuery}"`}{activeTab !== "ALL" && ` · ${activeCount} pada tab ini`}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{filteredBatches.map((batch) => <CatalogCard key={batch.id} batch={batch} />)}</div>
          </>
        )}
      </section>
    </div>
  );
}