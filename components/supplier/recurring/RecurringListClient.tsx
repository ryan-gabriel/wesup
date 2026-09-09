"use client";

import { useEffect, useReducer, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { RECURRING_CONFIG_MOCKS } from "@/lib/supplier-recurring/mock-data";
import {
  initialRecurringListState,
  recurringListReducer,
} from "@/lib/supplier-recurring/state";
import RecurringCard from "@/components/supplier/recurring/RecurringCard";

type FilterTab = "ALL" | "ACTIVE" | "INACTIVE";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Nonaktif" },
];

export default function RecurringListClient() {
  const [state, dispatch] = useReducer(recurringListReducer, initialRecurringListState);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    dispatch({ type: "loadStarted" });
    void Promise.resolve(RECURRING_CONFIG_MOCKS).then((configs) =>
      dispatch({ type: "loadSucceeded", configs: [...configs] }),
    );
  }, []);

  const handleToggle = (configId: string) => {
    dispatch({ type: "toggleStarted", configId });
    const updated = state.configs.map((c) =>
      c.id === configId ? { ...c, isActive: !c.isActive } : c,
    );
    void Promise.resolve(updated.find((c) => c.id === configId)!).then((config) =>
      dispatch({ type: "toggleSucceeded", config }),
    );
  };

  const filteredConfigs = state.configs.filter((config) => {
    if (activeTab === "ACTIVE" && !config.isActive) return false;
    if (activeTab === "INACTIVE" && config.isActive) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        config.name.toLowerCase().includes(query) ||
        config.templateBatch.title.toLowerCase().includes(query) ||
        config.templateBatch.category.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const counts = {
    ALL: state.configs.length,
    ACTIVE: state.configs.filter((c) => c.isActive).length,
    INACTIVE: state.configs.filter((c) => !c.isActive).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Postingan Berulang
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola jadwal penawaran otomatis yang tayang berulang.
          </p>
        </div>
        <Link
          href="/supplier/recurring/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Plus aria-hidden="true" size={18} />
          Buat Jadwal Baru
        </Link>
      </section>

      {/* Search + Filters */}
      <section className="space-y-3">
        <div className="relative">
          <Search
            aria-hidden="true"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Cari jadwal berdasarkan nama, produk, atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            aria-label="Cari jadwal postingan berulang"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <SlidersHorizontal
            aria-hidden="true"
            size={14}
            className="ml-2 shrink-0 text-slate-400"
          />
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={
                activeTab === tab.value
                  ? "flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm sm:flex-none sm:px-4"
                  : "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 sm:flex-none sm:px-4"
              }
              aria-pressed={activeTab === tab.value}
            >
              {tab.label}
              <span className="ml-1 text-[10px] opacity-70">
                ({counts[tab.value]})
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Results */}
      <section aria-label="Daftar jadwal postingan berulang">
        {state.loadPhase === "loading" || state.loadPhase === "idle" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <CalendarClock
              aria-hidden="true"
              size={40}
              className="mx-auto animate-pulse text-slate-300"
            />
            <p className="mt-3 text-sm font-medium text-slate-500">
              Memuat jadwal postingan berulang...
            </p>
          </div>
        ) : filteredConfigs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <CalendarClock
              aria-hidden="true"
              size={40}
              className="mx-auto text-slate-300"
            />
            <p className="mt-3 text-sm font-medium text-slate-500">
              {searchQuery.trim()
                ? `Tidak ada jadwal yang cocok dengan "${searchQuery}".`
                : activeTab === "ACTIVE"
                  ? "Belum ada jadwal aktif."
                  : activeTab === "INACTIVE"
                    ? "Tidak ada jadwal nonaktif."
                    : "Belum ada jadwal postingan berulang. Mulai buat jadwal pertama Anda."}
            </p>
            {!searchQuery.trim() && (
              <Link
                href="/supplier/recurring/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus aria-hidden="true" size={16} />
                Buat Jadwal
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Menampilkan {filteredConfigs.length} jadwal
              {searchQuery.trim() && ` untuk "${searchQuery}"`}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredConfigs.map((config) => (
                <RecurringCard
                  key={config.id}
                  config={config}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
