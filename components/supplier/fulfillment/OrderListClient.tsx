"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ClipboardList,
  Package,
  QrCode,
  RefreshCw,
  ScanLine,
  Users,
} from "lucide-react";
import { fulfillmentMockRepository } from "@/lib/supplier-fulfillment/mock-repository";
import type { FulfillmentOrder } from "@/lib/supplier-fulfillment/types";
import {
  fulfillmentOrderListReducer,
  initialFulfillmentOrderListState,
  type OrderStatusFilter,
} from "@/lib/supplier-fulfillment/state";
import { Skeleton, SkeletonTableRow } from "@/components/ui/SkeletonLoading";

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

type StatusMeta = {
  label: string;
  className: string;
  dot: string;
};

const STATUS_META: Record<string, StatusMeta> = {
  registered: {
    label: "Terdaftar",
    className: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
  },
  pending_payment: {
    label: "Menunggu Bayar",
    className: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  paid: {
    label: "Lunas",
    className: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  picked_up: {
    label: "Sudah Diambil",
    className: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  no_show: {
    label: "Tidak Hadir",
    className: "bg-red-100 text-red-700",
    dot: "bg-red-500",
  },
  cancelled: {
    label: "Dibatalkan",
    className: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
};

const FILTER_TABS: OrderStatusFilter[] = [
  "ALL",
  "paid",
  "picked_up",
  "pending_payment",
  "registered",
  "no_show",
];

const FILTER_LABELS: Record<OrderStatusFilter, string> = {
  ALL: "Semua",
  paid: "Lunas",
  picked_up: "Diambil",
  pending_payment: "Menunggu Bayar",
  registered: "Terdaftar",
  no_show: "Tidak Hadir",
  cancelled: "Dibatalkan",
};

const abort = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";
const message = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export default function OrderListClient({ batchId }: { batchId: string }) {
  const [state, dispatch] = useReducer(
    fulfillmentOrderListReducer,
    initialFulfillmentOrderListState,
  );
  const [retry, setRetry] = useState(0);

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

  const counts = useMemo(() => {
    const list = state.orders;
    const count = (status: OrderStatusFilter) =>
      status === "ALL"
        ? list.length
        : list.filter((o) => o.status === status).length;
    return count;
  }, [state.orders]);

  const visibleOrders = useMemo(() => {
    if (state.filter === "ALL") return state.orders;
    return state.orders.filter((o) => o.status === state.filter);
  }, [state.orders, state.filter]);

  const paidReadyCount = state.orders.filter(
    (o) => o.status === "paid",
  ).length;

  if (state.loadPhase === "idle" || state.loadPhase === "loading") {
    return (
      <div className="space-y-4">
        <BackLink batchId={batchId} />
        <Skeleton className="mb-4 h-9 w-64" />
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-500">
              <tr>
                {["UMKM", "Kuantitas", "Total", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SkeletonTableRow columns={5} />
              <SkeletonTableRow columns={5} />
              <SkeletonTableRow columns={5} />
            </tbody>
          </table>
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
            <h2 className="text-lg font-bold text-slate-900">
              Pesanan belum dapat dimuat
            </h2>
            <p className="mt-1 text-sm text-red-700">
              {state.loadError ?? "Terjadi kesalahan."}
            </p>
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

  const isEmpty = state.orders.length === 0;

  return (
    <div className="space-y-6">
      <BackLink batchId={batchId} />

      {/* Header */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            <ClipboardList aria-hidden="true" size={26} className="text-blue-600" />
            Manajemen Pesanan
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Daftar UMKM yang akan mengambil barang pada batch ini.
          </p>
        </div>
        <Link
          href={`/supplier/batch/${batchId}/pickup`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <ScanLine aria-hidden="true" size={18} />
          Buka Serah Terima
        </Link>
      </section>

      {/* Summary strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={<Users className="text-indigo-600" size={20} />}
          iconBg="bg-indigo-100"
          label="Total Pesanan"
          value={String(state.orders.length)}
        />
        <SummaryCard
          icon={<QrCode className="text-blue-600" size={20} />}
          iconBg="bg-blue-100"
          label="Lunas (siap ambil)"
          value={String(paidReadyCount)}
        />
        <SummaryCard
          icon={<Package className="text-emerald-600" size={20} />}
          iconBg="bg-emerald-100"
          label="Sudah Diambil"
          value={String(counts("picked_up"))}
        />
        <SummaryCard
          icon={<Package className="text-amber-600" size={20} />}
          iconBg="bg-amber-100"
          label="Menunggu Bayar"
          value={String(counts("pending_payment"))}
        />
      </section>

      {/* Filter tabs */}
      <section className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => dispatch({ type: "filterChanged", filter: tab })}
            aria-pressed={state.filter === tab}
            className={
              state.filter === tab
                ? "rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                : "rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            }
          >
            {FILTER_LABELS[tab]}
            <span className="ml-1 text-[10px] opacity-70">
              ({counts(tab)})
            </span>
          </button>
        ))}
      </section>

      {/* Empty state */}
      {isEmpty || visibleOrders.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <ClipboardList
            aria-hidden="true"
            size={40}
            className="mx-auto text-slate-300"
          />
          <p className="mt-3 text-sm font-medium text-slate-500">
            {isEmpty
              ? "Belum ada pesanan untuk batch ini."
              : `Tidak ada pesanan berstatus "${FILTER_LABELS[state.filter]}".`}
          </p>
          {isEmpty && (
            <Link
              href={`/supplier/batch/${batchId}/pickup`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <ScanLine aria-hidden="true" size={16} />
              Buka Serah Terima
            </Link>
          )}
        </section>
      ) : (
        <section aria-label="Daftar pesanan" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">UMKM</th>
                  <th className="px-4 py-3 font-medium">Kode</th>
                  <th className="px-4 py-3 font-medium">Kuantitas</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleOrders.map((order) => (
                  <OrderRow key={order.registrationId} order={order} batchId={batchId} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {visibleOrders.map((order) => (
              <OrderCard key={order.registrationId} order={order} batchId={batchId} />
            ))}
          </div>
        </section>
      )}
    </div>
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

function StatusBadge({ status }: { status: string }) {
  const meta =
    STATUS_META[status] ?? {
      label: status,
      className: "bg-slate-100 text-slate-700",
      dot: "bg-slate-400",
    };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function OrderRow({
  order,
  batchId,
}: {
  order: FulfillmentOrder;
  batchId: string;
}) {
  return (
    <tr className="transition hover:bg-slate-50">
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-900">{order.umkmName}</p>
        <p className="text-xs text-slate-500">
          {dates.format(new Date(order.createdAt))}
        </p>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-slate-500">
        {order.displayCode}
      </td>
      <td className="px-4 py-3">{order.quantity} pcs</td>
      <td className="px-4 py-3">
        {order.lockedTier ? `Tier ${order.lockedTier}` : "—"}
      </td>
      <td className="px-4 py-3 font-semibold text-slate-900">
        {order.finalAmount != null ? money.format(order.finalAmount) : "—"}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={order.status} />
      </td>
      <td className="px-4 py-3 text-right">
        {order.status === "paid" ? (
          <Link
            href={`/supplier/batch/${batchId}/pickup?reg=${order.registrationId}`}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <ScanLine aria-hidden="true" size={14} />
            Serah Terima
          </Link>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}

function OrderCard({
  order,
  batchId,
}: {
  order: FulfillmentOrder;
  batchId: string;
}) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{order.umkmName}</p>
          <p className="font-mono text-xs text-slate-500">{order.displayCode}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
        <span>
          Kuantitas: <strong className="text-slate-900">{order.quantity} pcs</strong>
        </span>
        <span>
          Tier:{" "}
          <strong className="text-slate-900">
            {order.lockedTier ? `Tier ${order.lockedTier}` : "—"}
          </strong>
        </span>
        <span>
          Total:{" "}
          <strong className="text-slate-900">
            {order.finalAmount != null ? money.format(order.finalAmount) : "—"}
          </strong>
        </span>
        <span>
          Daftar:{" "}
          <strong className="text-slate-900">
            {dates.format(new Date(order.createdAt))}
          </strong>
        </span>
      </div>
      {order.status === "paid" && (
        <Link
          href={`/supplier/batch/${batchId}/pickup?reg=${order.registrationId}`}
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
        >
          <ScanLine aria-hidden="true" size={14} />
          Serah Terima
        </Link>
      )}
    </div>
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
