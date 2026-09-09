"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Package,
  Power,
  TrendingDown,
} from "lucide-react";
import { RECURRING_CONFIG_MOCKS } from "@/lib/supplier-recurring/mock-data";
import { formatInterval } from "@/lib/supplier-recurring/mock-data";
import {
  DAY_LABELS,
  type DayOfWeek,
  type RecurringConfig,
} from "@/lib/supplier-recurring/types";
import RecurringBatchPreviewCard from "@/components/supplier/recurring/RecurringBatchPreview";
import RecurringConfirmDialog from "@/components/supplier/recurring/RecurringConfirmDialog";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

interface RecurringDetailClientProps {
  configId: string;
}

export default function RecurringDetailClient({ configId }: RecurringDetailClientProps) {
  const [config, setConfig] = useState<RecurringConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(RECURRING_CONFIG_MOCKS.find((c) => c.id === configId)).then(
      (found) => {
        if (cancelled) return;
        setLoading(false);
        if (found) setConfig(found);
        else setNotFound(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [configId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8">
        <p role="status" className="mx-auto max-w-5xl text-sm text-slate-700">
          Memuat detail jadwal...
        </p>
      </main>
    );
  }

  if (notFound || !config) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8">
        <section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Jadwal tidak ditemukan</h1>
          <p className="mt-2 text-sm text-slate-700">
            ID jadwal yang diminta: {configId}
          </p>
          <Link
            href="/supplier/recurring"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
          >
            <ArrowLeft size={16} />
            Kembali ke daftar jadwal
          </Link>
        </section>
      </main>
    );
  }

  const dayLabels = config.daysOfWeek
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d as DayOfWeek])
    .join(", ");

  const preview = {
    configId: config.id,
    configName: config.name,
    templateTitle: config.templateBatch.title,
    category: config.templateBatch.category,
    estimatedRegistrationOpensAt: config.nextGenerationAt ?? new Date().toISOString(),
    estimatedRegistrationClosesAt: "2026-09-11T10:00:00.000Z",
    estimatedPaymentOpensAt: "2026-09-11T10:00:01.000Z",
    estimatedPaymentClosesAt: "2026-09-12T08:00:00.000Z",
    estimatedReadyAt: "2026-09-15T02:00:00.000Z",
    tiers: config.templateBatch.tiers,
    pickupName: config.templateBatch.pickupName,
    pickupAddress: config.templateBatch.pickupAddress,
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Back link */}
        <Link
          href="/supplier/recurring"
          className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={16} />
          Kembali ke daftar jadwal
        </Link>

        {/* Header */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span
                  className={
                    config.isActive
                      ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                      : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                  }
                >
                  {config.isActive ? (
                    <CheckCircle2 aria-hidden="true" size={14} />
                  ) : (
                    <AlertCircle aria-hidden="true" size={14} />
                  )}
                  {config.isActive ? "Aktif" : "Nonaktif"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                  <Package aria-hidden="true" size={14} />
                  {config.templateBatch.category}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
                {config.name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                ID: {config.id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!config.isActive}
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-blue-600 px-5 py-2.5 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Power aria-hidden="true" size={16} />
              {config.isActive ? "Konfirmasi Tayang" : "Nonaktif"}
            </button>
          </div>
        </section>

        {/* Schedule Info */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 border-b pb-3 text-sm font-bold text-slate-900">
            <Calendar size={18} className="text-blue-500" />
            Jadwal
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Clock size={16} className="mt-1 shrink-0 text-indigo-500" />
              <div>
                <dt className="text-xs text-slate-500">Interval</dt>
                <dd className="font-semibold text-slate-900">
                  {formatInterval(config.intervalDays)}
                  {dayLabels ? ` \u00b7 ${dayLabels}` : ""}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarClock size={16} className="mt-1 shrink-0 text-blue-500" />
              <div>
                <dt className="text-xs text-slate-500">Batch Berikutnya</dt>
                <dd className="font-semibold text-slate-900">
                  {config.nextGenerationAt
                    ? dates.format(new Date(config.nextGenerationAt))
                    : "Belum dijadwalkan"}
                </dd>
              </div>
            </div>
            {config.lastGeneratedAt && (
              <div className="flex items-start gap-3">
                <CalendarClock size={16} className="mt-1 shrink-0 text-slate-400" />
                <div>
                  <dt className="text-xs text-slate-500">Terakhir Generate</dt>
                  <dd className="font-semibold text-slate-900">
                    {dates.format(new Date(config.lastGeneratedAt))}
                  </dd>
                </div>
              </div>
            )}
          </dl>
        </section>

        {/* Template Summary */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 border-b pb-3 text-sm font-bold text-slate-900">
            <Package size={18} className="text-blue-500" />
            Template Batch
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Nama Produk</dt>
              <dd className="font-semibold text-slate-900">
                {config.templateBatch.title}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Deskripsi</dt>
              <dd className="max-w-sm text-right text-slate-900">
                {config.templateBatch.description}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-500">Lokasi</dt>
              <dd className="text-right">
                <p className="font-semibold text-slate-900">
                  {config.templateBatch.pickupName}
                </p>
                <p className="text-slate-600">{config.templateBatch.pickupAddress}</p>
              </dd>
            </div>
          </dl>
        </section>

        {/* Tier */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 border-b pb-3 text-sm font-bold text-slate-900">
            <TrendingDown size={18} className="text-blue-500" />
            Skema Harga Tier
          </h2>
          <ul className="space-y-2 text-sm">
            {config.templateBatch.tiers.map((tier) => (
              <li key={tier.tierNumber} className="flex justify-between gap-3">
                <span className="text-slate-600">
                  Tier {tier.tierNumber}: {tier.minimumQuantity}–
                  {tier.maximumQuantity ?? "+"} pcs
                </span>
                <strong className="text-slate-900">{money.format(tier.pricePerUnit)}</strong>
              </li>
            ))}
          </ul>
        </section>

        {/* Preview */}
        <RecurringBatchPreviewCard preview={preview} />

        {/* Reminder info */}
        <section className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Notifikasi H-1</p>
            <p className="mt-1">
              Anda akan menerima pengingat satu hari sebelum batch tayang untuk
              melakukan review. Jika tidak dikonfirmasi, batch akan dibatalkan
              otomatis oleh sistem.
            </p>
          </div>
        </section>
      </div>

      <RecurringConfirmDialog
        open={confirmOpen}
        configName={config.name}
        nextDate={config.nextGenerationAt}
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
