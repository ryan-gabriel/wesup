"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  History,
  Plus,
  ScrollText,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { SUPPLIER_REPORT_MOCKS } from "@/lib/supplier-report/mock-data";
import ReportStatusBadge from "./ReportStatusBadge";
import EscrowStatusBadge from "./EscrowStatusBadge";

type FilterTab = "ALL" | "pending" | "under_review" | "resolved_supplier";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "Semua" },
  { value: "pending", label: "Menunggu" },
  { value: "under_review", label: "Diverifikasi" },
  { value: "resolved_supplier", label: "Selesai" },
];

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export default function ReportHistoryClient() {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");

  const filtered = useMemo(() => {
    const all = [...SUPPLIER_REPORT_MOCKS].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (activeTab === "ALL") return all;
    return all.filter((r) =>
      activeTab === "resolved_supplier"
        ? r.status === "resolved_supplier" || r.status === "resolved_umkm"
        : r.status === activeTab,
    );
  }, [activeTab]);

  const counts = useMemo(() => {
    const all = SUPPLIER_REPORT_MOCKS.length;
    const pending = SUPPLIER_REPORT_MOCKS.filter((r) => r.status === "pending").length;
    const underReview = SUPPLIER_REPORT_MOCKS.filter(
      (r) => r.status === "under_review",
    ).length;
    const resolved = SUPPLIER_REPORT_MOCKS.filter(
      (r) => r.status === "resolved_supplier" || r.status === "resolved_umkm",
    ).length;
    return {
      ALL: all,
      pending,
      under_review: underReview,
      resolved_supplier: resolved,
    } satisfies Record<FilterTab, number>;
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <History className="text-blue-600" aria-hidden="true" size={28} />
            Riwayat Laporan
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Lacak status laporan UMKM bermasalah yang pernah Anda kirim.
          </p>
        </div>
        <Link
          href="/supplier/akun/laporan"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Plus aria-hidden="true" size={18} />
          Buat Laporan
        </Link>
      </header>

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
                ? "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm sm:px-4"
                : "rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 sm:px-4"
            }
          >
            {tab.label}
            <span className="ml-1 text-[10px] opacity-70">({counts[tab.value]})</span>
          </button>
        ))}
      </div>

      {/* List */}
      <section aria-label="Daftar laporan">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <FileText
              aria-hidden="true"
              size={40}
              className="mx-auto text-slate-300"
            />
            <p className="mt-3 text-sm font-medium text-slate-500">
              Belum ada laporan yang sesuai.
            </p>
            <Link
              href="/supplier/akun/laporan"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus aria-hidden="true" size={16} />
              Buat Laporan
            </Link>
          </div>
        ) : (
          <ul className="space-y-4" role="list">
            {filtered.map((report) => (
              <li
                key={report.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        {report.umkmName}
                      </h2>
                      <ReportStatusBadge status={report.status} />
                      <EscrowStatusBadge status={report.escrowStatus} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {report.batchTitle} · {report.batchDisplayCode}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Dilaporkan {dates.format(new Date(report.createdAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    <ScrollText size={12} aria-hidden="true" />
                    {report.photoUrls.length} foto
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {report.description}
                </p>

                {report.adminNotes && (
                  <div
                    className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm leading-5 ${
                      report.status === "resolved_supplier"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {report.status === "resolved_supplier" ? (
                      <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <ShieldX size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                    )}
                    <div>
                      <p className="font-semibold">Catatan verifikasi:</p>
                      <p>{report.adminNotes}</p>
                      {report.decidedAt && (
                        <p className="mt-0.5 text-xs opacity-80">
                          Diputus {dates.format(new Date(report.decidedAt))}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
