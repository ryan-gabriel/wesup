"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type RefObject } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Package,
  Pencil,
  Trash2,
  TrendingDown,
  Truck,
} from "lucide-react";
import DeleteCatalogDialog from "@/components/supplier-batch/DeleteCatalogDialog";
import { supplierBatchRepository } from "@/lib/supplier-batch/repository";
import {
  getCancellationWarnings,
  initialSupplierBatchState,
  supplierBatchReducer,
} from "@/lib/supplier-batch/state";
import type { SupplierBatchDetail } from "@/lib/supplier-batch/types";

export interface SupplierBatchDetailClientProps { batchId: string; }

export interface SupplierBatchHeaderProps {
  batch: SupplierBatchDetail;
  deleteButtonRef: RefObject<HTMLButtonElement | null>;
  onDelete: () => void;
}

const dates = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const abort = (error: unknown) => error instanceof Error && error.name === "AbortError";
const message = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
const progressFor = (registered: number, target: number) => target <= 0 ? 0 : Math.min(100, Math.max(0, registered / target * 100));
const tierRange = (min: number, max: number | null) => max === null ? `${min}+ pcs` : `${min}–${max} pcs`;

export function SupplierBatchHeader({ batch, deleteButtonRef, onDelete }: SupplierBatchHeaderProps) {
  const cancelled = batch.status === "CANCELLED_BY_SUPPLIER";
  const StatusIcon = cancelled ? AlertCircle : CheckCircle2;
  const statusClassName = cancelled
    ? "inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
    : "inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700";

  return (
    <>
      <div className="flex justify-end">
        <button
          ref={deleteButtonRef}
          type="button"
          disabled={cancelled}
          onClick={onDelete}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" size={16} />
          Hapus Katalog
        </button>
      </div>
      {cancelled ? (
        <p
          id="supplier-batch-status"
          role="status"
          aria-live="polite"
          tabIndex={-1}
          className="rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-semibold"
        >
          CANCELLED_BY_SUPPLIER — katalog ini telah dibatalkan oleh pemasok.
        </p>
      ) : null}
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className={statusClassName}>
                <StatusIcon aria-hidden="true" size={14} />
                {cancelled ? "Dibatalkan Pemasok" : "Sedang Berjalan"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                <Package aria-hidden="true" size={14} />
                {batch.category}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{batch.title}</h1>
            <p className="mt-1 text-sm text-gray-500">ID: {batch.displayCode}</p>
          </div>
          <div className="w-full md:w-auto">
            <button
              type="button"
              disabled
              aria-describedby="supplier-edit-unavailable"
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-blue-600 px-5 py-2.5 text-sm font-medium text-blue-600 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 md:w-auto"
            >
              <Pencil aria-hidden="true" size={18} />
              Edit Penawaran
            </button>
            <p id="supplier-edit-unavailable" className="sr-only">
              Pengeditan penawaran belum tersedia.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

export default function SupplierBatchDetailClient({ batchId }: SupplierBatchDetailClientProps) {
  const [state, dispatch] = useReducer(supplierBatchReducer, initialSupplierBatchState);
  const [retry, setRetry] = useState(0);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "loadStarted" });
    void supplierBatchRepository
      .getById(batchId, { signal: controller.signal })
      .then((batch) => dispatch(batch ? { type: "loadSucceeded", batch } : { type: "loadNotFound" }))
      .catch((error: unknown) => {
        if (!abort(error)) dispatch({ type: "loadFailed", message: message(error, "Gagal memuat katalog.") });
      });
    return () => {
      controller.abort();
      cancelControllerRef.current?.abort();
      cancelControllerRef.current = null;
    };
  }, [batchId, retry]);

  const batch = state.batch;
  if (state.loadPhase === "idle" || state.loadPhase === "loading") return <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8"><p role="status" className="mx-auto max-w-5xl text-sm text-slate-700">Memuat detail katalog…</p></main>;
  if (state.notFound) return <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8"><section className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-xl font-bold text-slate-900">Katalog tidak ditemukan</h1><p className="mt-2 text-sm text-slate-700">ID katalog yang diminta: {batchId}</p><Link href="/marketplace" className="mt-4 inline-flex text-sm font-semibold text-blue-700">Kembali ke marketplace</Link></section></main>;
  if (state.loadPhase === "error" || !batch) return <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8"><section className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-white p-6 shadow-sm"><h1 className="text-xl font-bold text-slate-900">Detail katalog belum dapat dimuat</h1><p className="mt-2 text-sm text-red-700">{state.loadError ?? "Gagal memuat katalog."}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Coba lagi</button></section></main>;

  const progress = progressFor(batch.registeredQuantity, batch.targetQuantity);
  const lowest = batch.tiers.at(-1)?.pricePerUnit ?? batch.basePrice;
  const remaining = Math.max(0, batch.targetQuantity - batch.registeredQuantity);
  const timeline = [["Pendaftaran dibuka", batch.timeline.registrationOpensAt, Calendar, "text-indigo-600"], ["Pendaftaran ditutup", batch.timeline.registrationClosesAt, Clock, "text-indigo-600"], ["Pembayaran dibuka", batch.timeline.paymentOpensAt, CreditCard, "text-rose-600"], ["Batas pembayaran", batch.timeline.paymentClosesAt, CreditCard, "text-rose-600"], ["Estimasi ready", batch.timeline.estimatedReadyAt, Truck, "text-emerald-600"]] as const;

  const cancelBatch = () => {
    if (state.cancelPhase === "loading" || !state.cancellationReason.trim()) return;
    cancelControllerRef.current?.abort();
    const controller = new AbortController();
    cancelControllerRef.current = controller;
    dispatch({ type: "cancelStarted" });
    void supplierBatchRepository
      .cancel(batch.id, { reason: state.cancellationReason }, { signal: controller.signal })
      .then((cancelled) => {
        if (!controller.signal.aborted) dispatch({ type: "cancelSucceeded", batch: cancelled });
      })
      .catch((error: unknown) => {
        if (!abort(error)) dispatch({ type: "cancelFailed", message: message(error, "Gagal membatalkan katalog.") });
      })
      .finally(() => {
        if (cancelControllerRef.current === controller) cancelControllerRef.current = null;
      });
  };

  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-8"><div className="mx-auto max-w-5xl space-y-6"><SupplierBatchHeader batch={batch} deleteButtonRef={deleteRef} onDelete={() => dispatch({ type: "deleteOpened" })} />
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"><section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="mb-4 flex items-center gap-2 border-b pb-3 font-semibold"><TrendingDown size={18} className="text-blue-500" />Skema Tier Diskon</h2><div className="mb-4 flex justify-between"><div><span className="text-xs text-gray-500">Harga Dasar</span><p className="text-lg text-gray-400 line-through">{money.format(batch.basePrice)}</p></div><div className="text-right"><span className="text-xs font-bold text-blue-600">Target Diskon</span><p className="text-2xl font-bold">{money.format(lowest)}</p></div></div><ul className="space-y-2 border-t pt-3 text-sm">{batch.tiers.map((tier) => <li key={tier.tierNumber} className="flex justify-between gap-3"><span>Tier {tier.tierNumber}: {tierRange(tier.minimumQuantity, tier.maximumQuantity)}</span><strong>{money.format(tier.pricePerUnit)}</strong></li>)}</ul><div className="pt-4"><div className="mb-2 flex justify-between text-xs"><span className="flex items-center gap-1"><Package size={12} />{batch.registeredQuantity} / {batch.targetQuantity} pcs</span><span>{Math.round(progress)}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-gray-500">{batch.participantCount} peserta, {batch.paidParticipantCount} sudah membayar</p></div><p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700"><AlertCircle size={14} />Butuh {remaining} pcs lagi untuk capai target</p></section>
  <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="mb-4 flex items-center gap-2 border-b pb-3 font-semibold"><Clock size={18} className="text-indigo-500" />Timeline Batch</h2><dl className="space-y-4 text-sm">{timeline.map(([label, value, Icon, color]) => <div key={label} className="flex items-start gap-3"><Icon size={16} className={`mt-1 ${color}`} /><div><dt className="text-xs text-gray-500">{label}</dt><dd className="font-semibold">{dates.format(new Date(value))}</dd></div></div>)}</dl></section>
  <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm md:col-span-2 lg:col-span-1"><h2 className="mb-4 flex items-center gap-2 border-b pb-3 font-semibold"><MapPin size={18} className="text-orange-500" />Lokasi Pengambilan</h2><div className="flex items-start gap-3"><MapPin size={16} className="mt-1 shrink-0 text-orange-600" /><div className="text-sm"><strong className="block text-base">{batch.pickup.name}</strong><p>{batch.pickup.address}</p><p className="mt-2 text-xs text-gray-500">Koordinat: {batch.pickup.latitude}, {batch.pickup.longitude}</p></div></div><div className="relative mt-4 flex h-32 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100"><div className="absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwdjIwSDIwVjBIMHptMTkgMTlIMVYxSDE5djE4eiIgZmlsbD0iI2QxZDVkYiI+PC9wYXRoPgo8L3N2Zz4=')]" /><span className="relative rounded-full bg-white px-3 py-1.5 text-xs font-bold">Lokasi pengambilan Bandung</span></div></section></div></div>
  <DeleteCatalogDialog open={state.dialogOpen} batch={batch} reason={state.cancellationReason} warnings={getCancellationWarnings(batch)} phase={state.cancelPhase} error={state.cancelError} onReasonChange={(value) => dispatch({ type: "reasonChanged", value })} onCancel={() => dispatch({ type: "deleteClosed" })} onConfirm={cancelBatch} returnFocusRef={deleteRef} />
  </main>;
}
