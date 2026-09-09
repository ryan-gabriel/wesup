"use client";

import { AlertCircle, Calendar, Clock, CreditCard, Truck } from "lucide-react";
import type { CatalogDraft, FieldErrors } from "@/lib/supplier-catalog/types";

interface TimelineStepProps {
  draft: CatalogDraft;
  errors: FieldErrors;
  disabled: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onFieldChange: (
    field:
      | "registrationOpensAt"
      | "registrationClosesAt"
      | "paymentOpensAt"
      | "paymentClosesAt"
      | "estimatedReadyAt",
    value: string,
  ) => void;
}

const TIMELINE_FIELDS = [
  {
    field: "registrationOpensAt" as const,
    label: "Waktu Buka Pendaftaran",
    icon: Calendar,
    color: "text-indigo-600",
    description: "Kapan pendaftaran dibuka untuk UMKM.",
  },
  {
    field: "registrationClosesAt" as const,
    label: "Waktu Tutup Pendaftaran",
    icon: Clock,
    color: "text-indigo-600",
    description: "Batas akhir UMKM mendaftar.",
  },
  {
    field: "paymentOpensAt" as const,
    label: "Mulai Payment Window",
    icon: CreditCard,
    color: "text-rose-600",
    description: "Kapan UMKM mulai bisa membayar.",
  },
  {
    field: "paymentClosesAt" as const,
    label: "Batas Akhir Payment",
    icon: CreditCard,
    color: "text-rose-600",
    description: "Batas akhir UMKM melakukan pembayaran.",
  },
  {
    field: "estimatedReadyAt" as const,
    label: "Estimasi Barang Ready",
    icon: Truck,
    color: "text-emerald-600",
    description: "Kapan barang siap diambil di lokasi.",
  },
] as const;

export default function TimelineStep({
  draft,
  errors,
  disabled,
  headingRef,
  onFieldChange,
}: TimelineStepProps) {
  return (
    <div className="space-y-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold text-slate-900 outline-none"
      >
        Timeline Penawaran
      </h2>
      <p className="text-sm text-slate-500">
        Atur jadwal mutlak penawaran. Urutan waktu harus linear: Buka &lt; Tutup &lt; Mulai Payment &lt; Batas Payment &lt; Ready.
      </p>

      {/* Time travel warning */}
      {errors.timelineOrder && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">{errors.timelineOrder}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {TIMELINE_FIELDS.map(({ field, label, icon: Icon, color, description }) => (
          <div
            key={field}
            className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="mt-1 shrink-0">
              <Icon size={20} className={color} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label
                    htmlFor={`timeline-${field}`}
                    className="text-sm font-semibold text-slate-800"
                  >
                    {label} <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-slate-500">{description}</p>
                </div>
                <input
                  id={`timeline-${field}`}
                  type="datetime-local"
                  required
                  value={draft[field]}
                  onChange={(e) => onFieldChange(field, e.target.value)}
                  disabled={disabled}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 sm:mt-0"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Visual timeline */}
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Urutan Timeline
        </p>
        <div className="flex items-center gap-1 overflow-x-auto pb-2 text-[10px] text-slate-600">
          {TIMELINE_FIELDS.map(({ field, color }, index) => (
            <span key={field} className="flex items-center gap-1 shrink-0">
              <span className={`font-semibold ${draft[field] ? color : "text-slate-400"}`}>
                {draft[field]
                  ? new Date(draft[field]).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--"}
              </span>
              {index < TIMELINE_FIELDS.length - 1 && (
                <span className="text-slate-300">&rarr;</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-4 text-xs text-blue-800">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Validasi Waktu:</p>
          <ul className="mt-1 space-y-0.5">
            <li>&bull; Semua waktu harus di masa depan.</li>
            <li>&bull; Urutan harus linear: Buka &lt; Tutup &lt; Mulai Payment &lt; Batas Payment &lt; Ready.</li>
            <li>&bull; Sistem akan menolak jika urutan tidak logis.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
