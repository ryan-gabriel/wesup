"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, X } from "lucide-react";

interface RecurringConfirmDialogProps {
  open: boolean;
  configName: string;
  nextDate: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RecurringConfirmDialog({
  open,
  configName,
  nextDate,
  onConfirm,
  onCancel,
}: RecurringConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const formattedDate = nextDate
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(nextDate))
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="confirm-dialog-title"
            className="flex items-center gap-2 text-lg font-bold text-slate-900"
          >
            <CalendarClock size={20} className="text-blue-600" />
            Konfirmasi Jadwal
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-6 space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">
                Anda wajib mengkonfirmasi setiap batch yang akan tayang.
                Jika tidak dikonfirmasi dalam batas waktu, batch akan
                <strong> dibatalkan otomatis</strong> oleh sistem.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="text-slate-600">Jadwal:</p>
            <p className="font-semibold text-slate-900">{configName}</p>
            {formattedDate && (
              <p className="mt-1 text-xs text-slate-500">
                Batch berikutnya tayang: <strong>{formattedDate}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            Batal
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <CheckCircle2 size={16} />
            Konfirmasi Tayang
          </button>
        </div>
      </div>
    </div>
  );
}
