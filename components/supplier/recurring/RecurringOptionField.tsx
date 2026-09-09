"use client";

import { AlertCircle, Calendar, CalendarClock, Clock, Sparkles } from "lucide-react";
import type { DayOfWeek, RecurringOptionDraft } from "@/lib/supplier-recurring/types";

interface RecurringOptionFieldProps {
  recurring: RecurringOptionDraft;
  onEnabledChange: (enabled: boolean) => void;
  onFieldChange: (
    field: keyof RecurringOptionDraft,
    value: string | number | boolean | DayOfWeek[],
  ) => void;
}

const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function RecurringOptionField({
  recurring,
  onEnabledChange,
  onFieldChange,
}: RecurringOptionFieldProps) {  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">
            <CalendarClock size={20} className="text-indigo-600" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-indigo-900">
              Jadikan Postingan Berulang (Opsional)
            </h3>
            <p className="mt-1 text-xs text-indigo-700">
              Tayangkan penawaran ini berulang secara otomatis sesuai jadwal,
              dengan konfirmasi manual sebelum tiap batch tayang.
            </p>
          </div>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={recurring.enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="peer sr-only"
          />
          <span
            className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-5"
            aria-hidden="true"
          />
          <span className="sr-only">Aktifkan postingan berulang</span>
        </label>
      </div>

      {recurring.enabled && (
        <div className="mt-4 space-y-4 border-t border-indigo-200 pt-4">
          {/* Nama jadwal */}
          <div>
            <label
              htmlFor="recurring-option-name"
              className="flex items-center gap-1 text-xs font-semibold text-indigo-900"
            >
              <Sparkles size={12} />
              Nama Jadwal
            </label>
            <input
              id="recurring-option-name"
              type="text"
              value={recurring.name}
              onChange={(e) => onFieldChange("name", e.target.value)}
              placeholder="Contoh: Beras Rojolele Mingguan"
              className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Interval */}
          <div>
            <label
              htmlFor="recurring-option-interval"
              className="flex items-center gap-1 text-xs font-semibold text-indigo-900"
            >
              <Clock size={12} />
              Interval (hari)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="recurring-option-interval"
                type="number"
                min={1}
                max={365}
                value={recurring.intervalDays}
                onChange={(e) =>
                  onFieldChange("intervalDays", Number(e.target.value) || 1)
                }
                className="w-24 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <span className="text-xs text-indigo-700">hari</span>
            </div>
          </div>

          {/* Days of week */}
          {recurring.intervalDays > 1 && (
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-indigo-900">
                <Calendar size={12} />
                Hari Tayang (opsional)
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map((day) => {
                  const selected = recurring.daysOfWeek.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        onFieldChange(
                          "daysOfWeek",
                          selected
                            ? recurring.daysOfWeek.filter((d) => d !== day)
                            : [...recurring.daysOfWeek, day].sort((a, b) => a - b),
                        )
                      }
                      className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                        selected
                          ? "border border-indigo-400 bg-indigo-100 text-indigo-700"
                          : "border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50"
                      }`}
                      aria-pressed={selected}
                    >
                      {DAY_SHORT[day]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg bg-white/70 p-3 text-xs text-indigo-800">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>
              Batch berikutnya di-generate otomatis dari detail penawaran ini.
              Anda menerima notifikasi H-1 dan harus mengkonfirmasi sebelum tayang.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
