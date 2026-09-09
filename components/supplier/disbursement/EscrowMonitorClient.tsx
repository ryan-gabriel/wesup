"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock3,
  FileText,
  Landmark,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import {
  DISBURSEMENT_SUMMARY_MOCK,
  ESCROW_HOLD_MOCKS,
} from "@/lib/supplier-disbursement/mock-data";
import type { EscrowHoldStatus } from "@/lib/supplier-disbursement/types";
import EscrowHoldCard from "@/components/supplier/disbursement/EscrowHoldCard";

type FilterTab = "ALL" | EscrowHoldStatus;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "held", label: "Dibekukan" },
  { value: "released", label: "Dirilis" },
  { value: "refunded", label: "Dikembalikan" },
  { value: "forfeited", label: "Hangus" },
];

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default function EscrowMonitorClient() {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");

  const filtered = useMemo(() => {
    const all = [...ESCROW_HOLD_MOCKS].sort(
      (a, b) => new Date(b.pickupConfirmedAt).getTime() - new Date(a.pickupConfirmedAt).getTime(),
    );
    if (activeTab === "ALL") return all;
    return all.filter((h) => h.status === activeTab);
  }, [activeTab]);

  const counts = useMemo(() => {
    const map = new Map<FilterTab, number>([
      ["ALL", ESCROW_HOLD_MOCKS.length],
      ["held", 0],
      ["released", 0],
      ["refunded", 0],
      ["forfeited", 0],
    ]);
    ESCROW_HOLD_MOCKS.forEach((h) => {
      map.set(h.status, (map.get(h.status) ?? 0) + 1);
    });
    return map;
  }, []);

  const refundedSummary = useMemo(() => {
    let total = 0;
    let count = 0;
    ESCROW_HOLD_MOCKS.forEach((h) => {
      if (h.status === "refunded") {
        total += h.amount;
        count += 1;
      }
    });
    return { total, count };
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <Wallet className="text-emerald-600" aria-hidden="true" size={28} />
            Monitoring Escrow
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pantau dana escrow yang masuk, dibekukan, dirilis, atau hangus.
          </p>
        </div>
        <Link
          href="/supplier/akun/rekening"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Landmark aria-hidden="true" size={18} />
          Pengaturan Rekening
        </Link>
      </header>

      {/* Summary */}
      <section
        aria-label="Ringkasan escrow"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
            <Clock3 size={16} aria-hidden="true" />
            Dibekukan
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {money.format(DISBURSEMENT_SUMMARY_MOCK.totalHeld)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {DISBURSEMENT_SUMMARY_MOCK.heldCount} transaksi
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
            <Wallet size={16} aria-hidden="true" />
            Dirilis
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {money.format(DISBURSEMENT_SUMMARY_MOCK.totalReleased)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {DISBURSEMENT_SUMMARY_MOCK.releasedCount} transaksi
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
            <FileText size={16} aria-hidden="true" />
            Dikembalikan
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {money.format(refundedSummary.total)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {refundedSummary.count} transaksi · dana ke UMKM
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <ShieldAlert size={16} aria-hidden="true" />
            Hanggus (No-Show)
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {money.format(DISBURSEMENT_SUMMARY_MOCK.totalForfeited)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {DISBURSEMENT_SUMMARY_MOCK.forfeitedCount} transaksi
          </p>
        </div>
      </section>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            aria-pressed={activeTab === tab.value}
            className={
              activeTab === tab.value
                ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm sm:px-4"
                : "rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 sm:px-4"
            }
          >
            {tab.label}
            <span className="ml-1 text-[10px] opacity-70">
              ({counts.get(tab.value)})
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <section aria-label="Daftar dana escrow">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <Wallet
              aria-hidden="true"
              size={40}
              className="mx-auto text-slate-300"
            />
            <p className="mt-3 text-sm font-medium text-slate-500">
              Tidak ada dana escrow pada status ini.
            </p>
          </div>
        ) : (
          <ul className="space-y-4" role="list">
            {filtered.map((hold) => (
              <li key={hold.id}>
                <EscrowHoldCard hold={hold} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
