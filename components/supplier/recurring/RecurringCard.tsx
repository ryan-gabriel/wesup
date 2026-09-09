"use client";

import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Package,
  Power,
} from "lucide-react";
import type { RecurringConfig } from "@/lib/supplier-recurring/types";
import { DAY_LABELS, type DayOfWeek } from "@/lib/supplier-recurring/types";
import { formatInterval } from "@/lib/supplier-recurring/mock-data";

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

export interface RecurringCardProps {
  config: RecurringConfig;
  onToggle: (configId: string) => void;
}

export default function RecurringCard({ config, onToggle }: RecurringCardProps) {
  const isActive = config.isActive;
  const lowestPrice = config.templateBatch.tiers.at(-1)?.pricePerUnit ?? 0;
  const highestPrice = config.templateBatch.tiers.at(0)?.pricePerUnit ?? 0;
  const dayLabels = config.daysOfWeek
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d as DayOfWeek])
    .join(", ");

  return (
    <div
      className={`group block rounded-xl border bg-white shadow-sm transition ${
        isActive
          ? "border-emerald-200 hover:border-emerald-300 hover:shadow-md"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <span
                className={
                  isActive
                    ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                    : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
                }
              >
                {isActive ? (
                  <CheckCircle2 aria-hidden="true" size={12} />
                ) : (
                  <AlertCircle aria-hidden="true" size={12} />
                )}
                {isActive ? "Aktif" : "Nonaktif"}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                {config.templateBatch.category}
              </span>
            </div>
            <h3 className="truncate text-base font-bold text-slate-900">
              {config.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onToggle(config.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              isActive
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
            aria-label={isActive ? "Nonaktifkan jadwal" : "Aktifkan jadwal"}
          >
            <Power aria-hidden="true" size={14} />
            {isActive ? "Aktif" : "Aktifkan"}
          </button>
        </div>

        {/* Schedule Info */}
        <div className="mb-3 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock aria-hidden="true" size={14} className="shrink-0 text-indigo-500" />
            <span>{formatInterval(config.intervalDays)}</span>
            {dayLabels && (
              <span className="text-slate-400">&middot;</span>
            )}
            {dayLabels && <span>{dayLabels}</span>}
          </div>
          {config.nextGenerationAt && (
            <div className="flex items-center gap-2 text-slate-600">
              <CalendarClock aria-hidden="true" size={14} className="shrink-0 text-blue-500" />
              <span>
                Batch berikutnya:{" "}
                <strong className="text-slate-900">
                  {dates.format(new Date(config.nextGenerationAt))}
                </strong>
              </span>
            </div>
          )}
          {config.lastGeneratedAt && (
            <div className="flex items-center gap-2 text-slate-500">
              <Package aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
              <span>
                Terakhir generate:{" "}
                {dates.format(new Date(config.lastGeneratedAt))}
              </span>
            </div>
          )}
        </div>

        {/* Template Batch Preview */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Package aria-hidden="true" size={12} />
            Template: {config.templateBatch.title}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-blue-700">
              {money.format(lowestPrice)}
            </span>
            {lowestPrice < highestPrice && (
              <span className="text-xs text-slate-400 line-through">
                {money.format(highestPrice)}
              </span>
            )}
          </div>
          <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
            {config.templateBatch.tiers.map((tier) => (
              <li key={tier.tierNumber} className="flex justify-between">
                <span>
                  Tier {tier.tierNumber}: {tier.minimumQuantity}–
                  {tier.maximumQuantity ?? "+"} pcs
                </span>
                <strong className="text-slate-800">
                  {money.format(tier.pricePerUnit)}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-5 py-3">
        <Link
          href={`/supplier/recurring/${config.id}`}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          Lihat Detail &rarr;
        </Link>
      </div>
    </div>
  );
}
