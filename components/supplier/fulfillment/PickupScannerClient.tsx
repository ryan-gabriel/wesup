"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import { fulfillmentMockRepository } from "@/lib/supplier-fulfillment/mock-repository";
import { supplierBatchApiRepository } from "@/lib/supplier-catalog/api-repository";
import { pickupViewReducer, initialPickupViewState } from "@/lib/supplier-fulfillment/pickup-state";
import type { FulfillmentError } from "@/lib/supplier-fulfillment/types";
import { useToast } from "@/components/ui/GlobalToast";
import ForceMajeureDialog from "@/components/supplier/fulfillment/ForceMajeureDialog";
import { Skeleton } from "@/components/ui/SkeletonLoading";

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const abort = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";
const message = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export default function PickupScannerClient({ batchId }: { batchId: string }) {
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(pickupViewReducer, initialPickupViewState);
  const [retry, setRetry] = useState(0);
  const [batchTitle, setBatchTitle] = useState<string>("batch ini");
  const { toast } = useToast();
  const forceMajeureRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void supplierBatchApiRepository
      .getById(batchId, { signal: controller.signal })
      .then((batch) => {
        if (batch) setBatchTitle(batch.title);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [batchId]);

  const preselectedReg =
    typeof window === "undefined" ? null : searchParams.get("reg");

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "loadStarted" });
    void fulfillmentMockRepository
      .listOrders(batchId, { signal: controller.signal })
      .then((list) => dispatch({ type: "loadSucceeded", orders: [...list.orders] }))
      .catch((error: unknown) => {
        if (!abort(error)) {
          dispatch({
            type: "loadFailed",
            message: message(error, "Gagal memuat pesanan."),
          });
        }
      });
    return () => controller.abort();
  }, [batchId, retry]);

  // Apply the preselected registration once orders have loaded.
  useEffect(() => {
    if (
      state.loadPhase === "success" &&
      preselectedReg &&
      state.orders.some((o) => o.registrationId === preselectedReg)
    ) {
      dispatch({ type: "selectOrder", registrationId: preselectedReg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loadPhase, preselectedReg]);

  const selectedOrder = useMemo(
    () =>
      state.orders.find(
        (o) => o.registrationId === state.selectedRegistrationId,
      ) ?? null,
    [state.orders, state.selectedRegistrationId],
  );

  const paidOrders = useMemo(
    () => state.orders.filter((o) => o.status === "paid"),
    [state.orders],
  );

  const confirmPickup = () => {
    if (!selectedOrder || state.confirmPhase === "loading") return;
    if (!state.code.trim()) {
      toast("Mohon masukkan kode terlebih dahulu.", "warning");
      return;
    }
    dispatch({ type: "confirmStarted" });
    void fulfillmentMockRepository
      .confirmPickup(selectedOrder.registrationId, {
        method: state.method,
        code: state.code,
      })
      .then((result) => {
        dispatch({ type: "confirmSucceeded", order: result.order });
        toast(
          "Serah terima berhasil. Pesanan ditandai Sudah Diambil.",
          "success",
        );
      })
      .catch((error: unknown) => {
        if (abort(error)) return;
        const errorMessage =
          error instanceof Error && error.message ? error.message : "Kode tidak valid.";
        dispatch({
          type: "confirmFailed",
          error: errorMessage as unknown as FulfillmentError,
        });
        toast(errorMessage, "error");
      });
  };

  const confirmForceMajeure = () => {
    if (state.forceMajeurePhase === "loading") return;
    dispatch({ type: "forceMajeureStarted" });
    void fulfillmentMockRepository
      .forceMajeureCancel(batchId)
      .then((result) => {
        dispatch({ type: "forceMajeureSucceeded", result });
        toast(
          "Pembatalan darurat diproses. Pesanan lunas masuk antrean refund.",
          "info",
        );
      })
      .catch((error: unknown) => {
        if (abort(error)) return;
        dispatch({
          type: "forceMajeureFailed",
          message: message(error, "Pembatalan darurat gagal."),
        });
      });
  };

  if (state.loadPhase === "idle" || state.loadPhase === "loading") {
    return (
      <div className="space-y-4">
        <BackLink batchId={batchId} />
        <Skeleton className="mb-4 h-9 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (state.loadPhase === "error") {
    return (
      <div className="space-y-4">
        <BackLink batchId={batchId} />
        <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-white p-10 text-center shadow-sm">
          <AlertCircle aria-hidden="true" size={40} className="text-red-300" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Tidak dapat dimuat</h2>
            <p className="mt-1 text-sm text-red-700">{state.loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => setRetry((v) => v + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Muat Ulang
          </button>
        </section>
      </div>
    );
  }

  const fmError = state.forceMajeureError;
  const pickedUpCount = state.orders.filter((o) => o.status === "picked_up").length;

  return (
    <div className="space-y-6">
      <BackLink batchId={batchId} />

      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <ScanLine aria-hidden="true" size={26} className="text-blue-600" />
            Serah Terima
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Validasi pengambilan barang oleh UMKM (pindai QR atau masukkan PIN).
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/supplier/batch/${batchId}/orders`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
          >
            <ClipboardList aria-hidden="true" size={18} />
            Manajemen Pesanan
          </Link>
          <Link
            href={`/supplier/batch/${batchId}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
          >
            <Truck aria-hidden="true" size={18} />
            Detail Batch
          </Link>
        </div>
      </section>

      {/* Escrow / readiness info */}
      <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Petunjuk serah terima</p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-blue-800">
          <li>
            Hanya pesanan berstatus <strong>Lunas</strong> yang dapat diverifikasi.
          </li>
          <li>
            Berhasil dipindai akan menandai pesanan{" "}
            <strong>Sudah Diambil</strong> dan memulai hitung mundur escrow 1×24 jam.
          </li>
          <li>
            Sediakan jendela 12 jam toleransi sejak estimasi ready untuk melayani pengambilan.
          </li>
        </ul>
      </section>

      {/* Summary strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SummaryCard
          icon={<Users className="text-indigo-600" size={20} />}
          iconBg="bg-indigo-100"
          label="Lunas"
          value={String(paidOrders.length)}
        />
        <SummaryCard
          icon={<CheckCircle2 className="text-emerald-600" size={20} />}
          iconBg="bg-emerald-100"
          label="Sudah Diambil"
          value={String(pickedUpCount)}
        />
        <SummaryCard
          icon={<Truck className="text-blue-600" size={20} />}
          iconBg="bg-blue-100"
          label="Total Pesanan"
          value={String(state.orders.length)}
        />
      </section>

      {/* Order selector + scanner */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Order selection */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <Users aria-hidden="true" size={18} className="text-indigo-500" />
            Pilih Pesanan UMKM
          </h2>
          {state.orders.length === 0 ? (
            <p className="text-sm text-slate-500">
              Belum ada pesanan pada batch ini.
            </p>
          ) : (
            <div className="space-y-2">
              <label htmlFor="pickup-order" className="sr-only">
                Pilih pesanan
              </label>
              <select
                id="pickup-order"
                value={selectedOrder?.registrationId ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "selectOrder",
                    registrationId: e.target.value || null,
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">— Pilih pesanan —</option>
                {state.orders.map((order) => (
                  <option key={order.registrationId} value={order.registrationId}>
                    {order.umkmName} · {order.displayCode} · {statusLabel(order.status)}
                  </option>
                ))}
              </select>

              {selectedOrder ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">
                      {selectedOrder.umkmName}
                    </p>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {selectedOrder.displayCode}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <dt>Kuantitas</dt>
                      <dd className="font-semibold text-slate-900">
                        {selectedOrder.quantity} {selectedOrder.unit}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Tier</dt>
                      <dd className="font-semibold text-slate-900">
                        {selectedOrder.lockedTier ? `Tier ${selectedOrder.lockedTier}` : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Daftar</dt>
                      <dd className="font-semibold text-slate-900">
                        {dates.format(new Date(selectedOrder.createdAt))}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Pilih pesanan UMKM untuk mulai verifikasi.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Scanner / PIN */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            {state.method === "qr" ? (
              <QrCode aria-hidden="true" size={18} className="text-blue-500" />
            ) : (
              <KeyRound aria-hidden="true" size={18} className="text-blue-500" />
            )}
            Verifikasi Kode
          </h2>

          {/* Method toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => dispatch({ type: "methodChanged", method: "qr" })}
              aria-pressed={state.method === "qr"}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition ${
                state.method === "qr"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <QrCode aria-hidden="true" size={16} />
              Pindai QR
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "methodChanged", method: "pin" })}
              aria-pressed={state.method === "pin"}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition ${
                state.method === "pin"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <KeyRound aria-hidden="true" size={16} />
              PIN 4-digit
            </button>
          </div>

          {state.method === "qr" ? (
            <div className="mt-4">
              <div
                role="img"
                aria-label="Area pemindaian QR"
                className="relative mx-auto flex aspect-square max-w-[220px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50"
              >
                <div className="absolute left-3 top-3 h-7 w-7 rounded-tl-lg border-l-2 border-t-2 border-blue-400" />
                <div className="absolute right-3 top-3 h-7 w-7 rounded-tr-lg border-r-2 border-t-2 border-blue-400" />
                <div className="absolute bottom-3 left-3 h-7 w-7 rounded-bl-lg border-b-2 border-l-2 border-blue-400" />
                <div className="absolute bottom-3 right-3 h-7 w-7 rounded-br-lg border-b-2 border-r-2 border-blue-400" />
                <div className="px-6 text-center">
                  <ScanLine aria-hidden="true" size={32} className="mx-auto text-blue-400" />
                  <p className="mt-2 text-xs text-slate-500">
                    Simulasi pemindai — kamera diaktifkan pada iterasi berikutnya.
                  </p>
                </div>
              </div>
              <label htmlFor="qr-code" className="mt-4 block text-sm font-semibold text-slate-800">
                Kode QR / hasil pindai
              </label>
              <input
                id="qr-code"
                type="text"
                value={state.code}
                onChange={(e) => dispatch({ type: "codeChanged", code: e.target.value })}
                placeholder="Tempel atau ketik kode QR"
                autoComplete="off"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          ) : (
            <div className="mt-4">
              <label htmlFor="pin-code" className="block text-sm font-semibold text-slate-800">
                PIN 4-digit UMKM
              </label>
              <input
                id="pin-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={state.code}
                onChange={(e) =>
                  dispatch({ type: "codeChanged", code: e.target.value.replace(/\D/g, "") })
                }
                placeholder="••••"
                autoComplete="off"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-2 text-xs text-slate-500">
                Cadangan operasional jika kamera tidak dapat digunakan.
              </p>
            </div>
          )}

          {state.confirmError ? (
            <p role="alert" aria-live="assertive" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.confirmError.message}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!selectedOrder || state.confirmPhase === "loading" || selectedOrder.status !== "paid"}
            onClick={confirmPickup}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.confirmPhase === "loading" ? (
              <>
                <RefreshCw aria-hidden="true" size={18} className="animate-spin" />
                Memvalidasi…
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden="true" size={18} />
                Konfirmasi Pengambilan
              </>
            )}
          </button>

          {selectedOrder && selectedOrder.status !== "paid" && !state.resultOrder && (
            <p className="mt-2 text-xs text-amber-700">
              Pesanan berstatus {statusLabel(selectedOrder.status)} belum dapat diverifikasi.
            </p>
          )}
        </div>
      </section>

      {/* Success result banner */}
      {state.resultOrder && (
        <section
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" size={24} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <h3 className="font-bold">Serah terima berhasil</h3>
              <p className="mt-1 text-sm">
                Pesanan{" "}
                <span className="font-semibold">{state.resultOrder.umkmName}</span> (
                {state.resultOrder.displayCode}) ditandai{" "}
                <strong>Sudah Diambil</strong> via{" "}
                {state.resultOrder.pickedUpByMethod === "qr" ? "pindai QR" : "PIN"}.
              </p>
              <p className="mt-1 text-sm">
                Hitung mundur escrow <strong>1×24 jam</strong> telah dimulai.
              </p>
              <button
                type="button"
                onClick={() => dispatch({ type: "resetResult" })}
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <RefreshCw aria-hidden="true" size={14} />
                Verifikasi pesanan lain
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Force Majeure */}
      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-red-800">
              <ShieldAlert aria-hidden="true" size={18} />
              Pembatalan Darurat (Force Majeure)
            </h3>
            <p className="mt-1 text-sm text-red-700">
              Batalkan seluruh batch karena kondisi di luar kendali (barang rusak, bencana).
              Pesanan lunas masuk antrean Full Refund; UMKM tidak dikenakan sanksi No-Show.
            </p>
          </div>
          <button
            ref={forceMajeureRef}
            type="button"
            onClick={() => dispatch({ type: "forceMajeureOpened" })}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            <ShieldAlert aria-hidden="true" size={16} />
            Instruksi Darurat
          </button>
        </div>
        {state.forceMajeureResult && (
          <p role="status" aria-live="polite" className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-800">
            Batch dibatalkan pada {dates.format(new Date(state.forceMajeureResult.cancelledAt))}.{" "}
            {state.forceMajeureResult.refundedOrderCount > 0
              ? `${state.forceMajeureResult.refundedOrderCount} pesanan lunas masuk antrean refund.`
              : "Belum ada pesanan lunas untuk direfund."}
          </p>
        )}
        {fmError && (
          <p role="alert" aria-live="assertive" className="mt-3 text-sm text-red-700">
            {fmError}
          </p>
        )}
      </section>

      <ForceMajeureDialog
        open={state.forceMajeureOpen}
        batchTitle={batchTitle}
        paidOrderCount={paidOrders.length}
        phase={state.forceMajeurePhase}
        error={state.forceMajeureError}
        onCancel={() => dispatch({ type: "forceMajeureClosed" })}
        onConfirm={confirmForceMajeure}
        returnFocusRef={forceMajeureRef}
      />
    </div>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    registered: "Terdaftar",
    pending_payment: "Menunggu Bayar",
    paid: "Lunas",
    picked_up: "Sudah Diambil",
    no_show: "Tidak Hadir",
    cancelled: "Dibatalkan",
  };
  return map[status] ?? status;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    registered: "bg-slate-100 text-slate-700",
    pending_payment: "bg-amber-100 text-amber-700",
    paid: "bg-blue-100 text-blue-700",
    picked_up: "bg-emerald-100 text-emerald-700",
    no_show: "bg-red-100 text-red-700",
    cancelled: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        styles[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function BackLink({ batchId }: { batchId: string }) {
  return (
    <Link
      href={`/supplier/batch/${batchId}`}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-blue-700"
    >
      <ArrowLeft aria-hidden="true" size={16} />
      Kembali ke detail batch
    </Link>
  );
}

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className="truncate text-lg font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
