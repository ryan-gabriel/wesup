"use client";

import Link from "next/link";
import { useEffect, useReducer, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
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
import { supplierBatchApiRepository, supplierCatalogApiRepository } from "@/lib/supplier-catalog/api-repository";
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

const statusLabel: Record<SupplierBatchDetail["status"], string> = {
  DRAFT: "Draft",
  PUBLISHED: "Aktif",
  CLOSED: "Selesai",
  CANCELLED_BY_SUPPLIER: "Dibatalkan pemasok",
  TAKEDOWN: "Diturunkan admin",
  COMPLETED: "Selesai",
};

const terminalStatusMessage: Partial<Record<SupplierBatchDetail["status"], string>> = {
  CLOSED: "Pendaftaran batch ini sudah ditutup dan katalog tidak dapat diedit.",
  CANCELLED_BY_SUPPLIER: "Katalog ini telah dibatalkan oleh pemasok.",
  TAKEDOWN: "Katalog ini diturunkan oleh Admin dan hanya dapat dibaca.",
  COMPLETED: "Batch ini sudah selesai dan hanya dapat dibaca.",
};

export function SupplierBatchHeader({ batch, deleteButtonRef, onDelete }: SupplierBatchHeaderProps) {
  const canEdit = batch.status === "DRAFT" || batch.status === "PUBLISHED";
  const StatusIcon = canEdit ? (batch.status === "DRAFT" ? Clock : CheckCircle2) : AlertCircle;
  const statusClassName = !canEdit
    ? "inline-flex items-center gap-1.5  bg-wesup-paper-sub px-2.5 py-1 text-xs font-semibold text-wesup-ink"
    : "inline-flex items-center gap-1.5  bg-wesup-paper-sub px-2.5 py-1 text-xs font-semibold text-wesup-ink";

  return (
    <>
      <div className="flex justify-end">
        <button
          ref={deleteButtonRef}
          type="button"
          disabled={!canEdit}
          onClick={onDelete}
          className="flex items-center gap-2  border border-wesup-red/40 bg-wesup-paper px-4 py-2 text-sm font-medium wesup-red disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" size={16} />
          Hapus Katalog
        </button>
      </div>
      {!canEdit && terminalStatusMessage[batch.status] ? (
        <p
          id="supplier-batch-status"
          role="status"
          aria-live="polite"
          tabIndex={-1}
          className=" border border-wesup-ink/20 bg-wesup-paper-sub px-4 py-3 text-sm font-semibold"
        >
          {statusLabel[batch.status]} — {terminalStatusMessage[batch.status]}
        </p>
      ) : null}
      <section className=" border border-wesup-ink/10 bg-wesup-paper p-6 ">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className={statusClassName}>
                <StatusIcon aria-hidden="true" size={14} />
                {statusLabel[batch.status]}
              </span>
              <span className="inline-flex items-center gap-1.5  bg-wesup-paper-sub px-2.5 py-1 text-xs font-medium text-wesup-red">
                <Package aria-hidden="true" size={14} />
                {batch.category}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-wesup-ink-sub md:text-3xl">{batch.title}</h1>
            <p className="mt-1 text-sm text-wesup-ink-sub">ID: {batch.displayCode}</p>
          </div>
          <div className="w-full md:w-auto">
            {!canEdit && terminalStatusMessage[batch.status] ? (
              <span className="flex w-full items-center justify-center gap-2  border-2 border-wesup-ink/20 px-5 py-2.5 text-sm font-medium text-wesup-ink-sub md:w-auto">
                <Pencil aria-hidden="true" size={18} />
                Edit Penawaran
              </span>
            ) : (
              <Link
                href={`/supplier/catalog/${batch.id}/edit`}
                className="flex w-full items-center justify-center gap-2  border-2 border-wesup-ink/20 px-5 py-2.5 text-sm font-medium text-wesup-red transition hover:bg-wesup-paper-sub md:w-auto"
              >
                <Pencil aria-hidden="true" size={18} />
                Edit Penawaran
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Fulfillment quick actions */}
      {(canEdit || batch.status === "CLOSED") && (
        <section className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/supplier/batches/${batch.id}/transaksi`}
            className="inline-flex items-center justify-center gap-2  bg-wesup-paper px-5 py-3 text-sm font-semibold transition hover:bg-wesup-paper hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:wesup-ink focus-visible:ring-offset-2"
          >
            <CreditCard aria-hidden="true" size={18} />
            Pusat Transaksi
          </Link>
          <Link
            href={`/supplier/batch/${batch.id}/orders`}
            className="inline-flex items-center justify-center gap-2  bg-wesup-ink px-5 py-3 text-sm font-semibold text-wesup-paper  transition hover:bg-wesup-red focus-visible:outline-none focus-visible:ring-2 focus-visible:outline-wesup-red focus-visible:ring-offset-2"
          >
            <Package aria-hidden="true" size={18} />
            Manajemen Pesanan
          </Link>
          <Link
            href={`/supplier/batch/${batch.id}/pickup`}
            className="inline-flex items-center justify-center gap-2  border border-wesup-ink/20 bg-wesup-paper px-5 py-3 text-sm font-semibold text-wesup-red transition hover:bg-wesup-paper-sub focus-visible:outline-none focus-visible:ring-2 focus-visible:outline-wesup-red focus-visible:ring-offset-2"
          >
            <Truck aria-hidden="true" size={18} />
            Serah Terima (QR / PIN)
          </Link>
        </section>
      )}
    </>
  );
}

export default function SupplierBatchDetailClient({ batchId }: SupplierBatchDetailClientProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(supplierBatchReducer, initialSupplierBatchState);
  const [retry, setRetry] = useState(0);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "loadStarted" });
    void supplierBatchApiRepository
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
  if (state.loadPhase === "idle" || state.loadPhase === "loading") return <main className="min-h-screen bg-wesup-paper p-6 text-wesup-ink md:p-8"><p role="status" className="mx-auto max-w-5xl text-sm text-wesup-ink">Memuat detail katalog…</p></main>;
  if (state.notFound) return <main className="min-h-screen bg-wesup-paper p-6 text-wesup-ink md:p-8"><section className="mx-auto max-w-5xl  border border-wesup-ink/15 bg-wesup-paper p-6 "><h1 className="text-xl font-bold text-wesup-ink">Katalog tidak ditemukan</h1><p className="mt-2 text-sm text-wesup-ink">ID katalog yang diminta: {batchId}</p><Link href="/marketplace" className="mt-4 inline-flex text-sm font-semibold text-wesup-ink">Kembali ke marketplace</Link></section></main>;
  if (state.loadPhase === "error" || !batch) return <main className="min-h-screen bg-wesup-paper p-6 text-wesup-ink md:p-8"><section className="mx-auto max-w-5xl  border border-wesup-red/40 bg-wesup-paper p-6 "><h1 className="text-xl font-bold text-wesup-ink">Detail katalog belum dapat dimuat</h1><p className="mt-2 text-sm text-wesup-red">{state.loadError ?? "Gagal memuat katalog."}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4  bg-wesup-ink px-4 py-2 text-sm font-semibold text-wesup-paper">Coba lagi</button></section></main>;

  const capacityTarget = batch.capacityQuantity ?? batch.targetQuantity;
  const progress = progressFor(batch.registeredQuantity, capacityTarget);
  const lowest = batch.tiers.at(-1)?.pricePerUnit ?? batch.basePrice;
  const remaining = Math.max(0, capacityTarget - batch.registeredQuantity);
  const timeline = [["Pendaftaran dibuka", batch.timeline.registrationOpensAt, Calendar, "text-wesup-ink-sub"], ["Pendaftaran ditutup", batch.timeline.registrationClosesAt, Clock, "text-wesup-ink-sub"], ["Pembayaran dibuka", batch.timeline.paymentOpensAt, CreditCard, "text-wesup-ink-sub"], ["Batas pembayaran", batch.timeline.paymentClosesAt, CreditCard, "text-wesup-ink-sub"], ["Estimasi ready", batch.timeline.estimatedReadyAt, Truck, "text-wesup-ink-sub"]] as const;

  const cancelBatch = () => {
    if (state.cancelPhase === "loading" || !state.cancellationReason.trim()) return;
    cancelControllerRef.current?.abort();
    const controller = new AbortController();
    cancelControllerRef.current = controller;
    dispatch({ type: "cancelStarted" });
    const operation = batch.status === "DRAFT"
      ? supplierCatalogApiRepository.delete(batch.id, { signal: controller.signal }).then(() => {
          if (!controller.signal.aborted) router.push("/supplier/catalog");
        })
      : supplierCatalogApiRepository.cancel(batch.id, state.cancellationReason, { signal: controller.signal }).then(async () => {
          const refreshed = await supplierBatchApiRepository.getById(batch.id, { signal: controller.signal });
          if (!controller.signal.aborted && refreshed) dispatch({ type: "cancelSucceeded", batch: refreshed });
        });
    void operation
      .catch((error: unknown) => {
        if (!abort(error)) dispatch({ type: "cancelFailed", message: message(error, "Gagal membatalkan katalog.") });
      })
      .finally(() => {
        if (cancelControllerRef.current === controller) cancelControllerRef.current = null;
      });
  };

  return <main className="h-fit bg-wesup-paper text-wesup-ink w-full"><div className="w-full space-y-6"><SupplierBatchHeader batch={batch} deleteButtonRef={deleteRef} onDelete={() => dispatch({ type: "deleteOpened" })} />
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"><section className=" border border-wesup-ink/10 bg-wesup-paper p-6 "><h2 className="mb-4 flex items-center gap-2 border-b pb-3 font-semibold"><TrendingDown size={18} className="text-wesup-red" />Skema Tier Diskon</h2><div className="mb-4 flex justify-between"><div><span className="text-xs text-wesup-ink-sub">Harga Dasar</span><p className="text-lg text-wesup-ink-sub line-through">{money.format(batch.basePrice)}</p></div><div className="text-right"><span className="text-xs font-bold text-wesup-red">Target Diskon</span><p className="text-2xl font-bold">{money.format(lowest)}</p></div></div><ul className="space-y-2 border-t pt-3 text-sm">{batch.tiers.map((tier) => <li key={tier.tierNumber} className="flex justify-between gap-3"><span>Tier {tier.tierNumber}: {tierRange(tier.minimumQuantity, tier.maximumQuantity)}</span><strong>{money.format(tier.pricePerUnit)}</strong></li>)}</ul><div className="pt-4"><div className="mb-2 flex justify-between text-xs"><span className="flex items-center gap-1"><Package size={12} />{batch.registeredQuantity} / {capacityTarget} {batch.unit ?? "pcs"}</span><span>{Math.round(progress)}%</span></div><div className="h-2.5 overflow-hidden  bg-wesup-paper-sub"><div className="h-full  bg-wesup-red" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-wesup-ink-sub">{batch.participantCount} peserta, {batch.paidParticipantCount} sudah membayar</p></div><p className="mt-4 flex items-center gap-2  bg-wesup-paper-sub px-3 py-2 text-xs text-wesup-ink"><AlertCircle size={14} />Butuh {remaining} {batch.unit ?? "pcs"} lagi untuk tutup kuota</p></section>
  <section className=" border border-wesup-ink/10 bg-wesup-paper p-6 "><h2 className="mb-4 flex items-center gap-2 border-b pb-3 font-semibold"><Clock size={18} className="text-wesup-ink-sub" />Timeline Batch</h2><dl className="space-y-4 text-sm">{timeline.map(([label, value, Icon, color]) => <div key={label} className="flex items-start gap-3"><Icon size={16} className={`mt-1 ${color}`} /><div><dt className="text-xs text-wesup-ink-sub">{label}</dt><dd className="font-semibold">{dates.format(new Date(value))}</dd></div></div>)}</dl></section>
  <section className=" border border-wesup-ink/10 bg-wesup-paper p-6  md:col-span-2 lg:col-span-1"><h2 className="mb-4 flex items-center gap-2 border-b pb-3 font-semibold"><MapPin size={18} className="text-wesup-ink-sub" />Lokasi Pengambilan</h2><div className="flex items-start gap-3"><MapPin size={16} className="mt-1 shrink-0 text-wesup-ink-sub" /><div className="text-sm"><strong className="block text-base">{batch.pickup.name}</strong><p>{batch.pickup.address}</p><p className="mt-2 text-xs text-wesup-ink-sub">Koordinat: {batch.pickup.latitude}, {batch.pickup.longitude}</p></div></div><div className="relative mt-4 flex h-32 items-center justify-center overflow-hidden  border border-wesup-ink/15 bg-wesup-paper-sub"><div className="absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwdjIwSDIwVjBIMHptMTkgMTlIMVYxSDE5djE4eiIgZmlsbD0iI2QxZDVkYiI+PC9wYXRoPgo8L3N2Zz4=')]" /><span className="relative  bg-wesup-paper px-3 py-1.5 text-xs font-bold">Lokasi pengambilan Bandung</span></div></section></div></div>
  <DeleteCatalogDialog mode={batch.status === "DRAFT" ? "delete" : "cancel"} open={state.dialogOpen} batch={batch} reason={state.cancellationReason} warnings={getCancellationWarnings(batch)} phase={state.cancelPhase} error={state.cancelError} onReasonChange={(value) => dispatch({ type: "reasonChanged", value })} onCancel={() => dispatch({ type: "deleteClosed" })} onConfirm={cancelBatch} returnFocusRef={deleteRef} />
  </main>;
}
