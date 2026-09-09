"use client";

import { useEffect, useRef } from "react";
import type React from "react";
import type { AsyncPhase } from "@/lib/supplier-fulfillment/types";

export interface ForceMajeureDialogProps {
  open: boolean;
  batchTitle: string;
  paidOrderCount: number;
  phase: AsyncPhase;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}

export default function ForceMajeureDialog({
  open,
  batchTitle,
  paidOrderCount,
  phase,
  error,
  onCancel,
  onConfirm,
  returnFocusRef,
}: ForceMajeureDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const loading = phase === "loading";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const dismiss = () => {
    if (!loading) onCancel();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="force-majeure-title"
      aria-describedby="force-majeure-description force-majeure-warnings"
      className="fixed left-1/2 top-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClose={() => {
        if (loading) {
          ref.current?.showModal();
          return;
        }
        onCancel();
        if (returnFocusRef.current && !returnFocusRef.current.disabled) {
          returnFocusRef.current.focus();
        }
      }}
    >
      <form
        className="p-6 text-slate-900"
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading) onConfirm();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="force-majeure-title" className="text-xl font-bold text-red-700">
              Pembatalan Darurat (Force Majeure)?
            </h2>
            <p id="force-majeure-description" className="mt-2 text-sm leading-6 text-gray-600">
              Batch{" "}
              <span className="font-semibold text-gray-900">{batchTitle}</span>{" "}
              akan dibatalkan karena kondisi di luar kendali (mis. barang rusak atau bencana).
              Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup dialog pembatalan darurat"
            disabled={loading}
            onClick={dismiss}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true" className="text-2xl leading-none">×</span>
          </button>
        </div>

        <div
          id="force-majeure-warnings"
          className="mt-5 space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {paidOrderCount > 0 ? (
            <p>
              {paidOrderCount} pesanan lunas akan masuk antrean Full Refund.
            </p>
          ) : (
            <p>Belum ada pesanan lunas pada batch ini.</p>
          )}
          <p>
            UMKM yang terdaftar tidak akan dikenakan sanksi No-Show atas pembatalan ini.
          </p>
        </div>

        {error ? (
          <p role="alert" aria-live="assertive" aria-atomic="true" className="mt-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={dismiss}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Memproses…" : "Ya, Batalkan Darurat"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
