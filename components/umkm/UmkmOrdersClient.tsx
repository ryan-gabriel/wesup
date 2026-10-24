"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, PackageCheck, RefreshCw, ShoppingBag, WalletCards } from "lucide-react";
import PaymentPageLink from "@/components/payments/PaymentPageLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/SkeletonLoading";
import type { OrderCapabilities, OrderSummary, UmkmOrderListItem } from "@/lib/orders/api-types";

import { feedbackError } from "@/lib/feedback/errors";

type FilterKey = "needs_action" | "ongoing" | "completed" | "all" | "pending_payment" | "paid" | "picked_up" | "registered" | "no_show" | "cancelled" | "refund";
type ClientOrder = UmkmOrderListItem & { batchStatus?: string | null };

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const FILTERS: Array<{key:FilterKey;label:string}>=[{key:"all",label:"Semua"},{key:"needs_action",label:"Perlu tindakan"},{key:"ongoing",label:"Berlangsung"},{key:"completed",label:"Selesai"},{key:"cancelled",label:"Dibatalkan"}];

/* Red = signal only. Alert states get the red chip; everything else is ink mono. */
const statusStyle: Record<string, { label: string; alert: boolean }> = {
  registered: { label: "Terdaftar", alert: false },
  pending_payment: { label: "Menunggu Bayar", alert: false },
  paid: { label: "Lunas", alert: false },
  picked_up: { label: "Sudah Diambil", alert: false },
  completed: { label: "Selesai", alert: false },
  no_show: { label: "Tidak Hadir", alert: true },
  cancelled: { label: "Dibatalkan", alert: true },
  refund_pending: { label: "Proses Refund", alert: false },
  refunded: { label: "Refund Selesai", alert: false },
};

const EMPTY_SUMMARY: OrderSummary = { total: 0, pendingPayment: 0, paidReady: 0, pickedUp: 0, refund: 0 };

function capabilitiesFor(order: ClientOrder): OrderCapabilities {
  return order.capabilities ?? {
    canPay: order.status === "pending_payment" && order.phase === "payment_open",
    canViewPickup: order.status === "paid" || order.status === "picked_up" || order.status === "completed",
    canComplain: order.status === "picked_up",
    canTrackDispute: false,
    canRate: order.status === "picked_up" || order.status === "completed",
    canSubmitRefundAccount: order.status === "refund_pending",
  };
}

function filterMatches(order: ClientOrder, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if(["needs_action","ongoing","completed","cancelled"].includes(filter)&&order.presentation)return order.presentation.group===filter;
  if (filter === "picked_up") return order.status === "picked_up" || order.status === "completed";
  if (filter === "refund") return order.status === "refund_pending" || order.status === "refunded";
  return order.status === filter;
}

function StatusChip({ status }: { status: string }) {
  const style = statusStyle[status] ?? { label: status, alert: false };
  return <span className={`inline-flex items-center px-2 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] ${style.alert ? "bg-wesup-red text-wesup-paper" : "bg-wesup-paper-sub text-wesup-ink"}`}>{style.label}</span>;
}

function ActionLinks({ order }: { order: ClientOrder }) {
  if(order.presentation)return <Link href={`/umkm/pesanan/${order.id}`} className="inline-flex min-h-11 items-center border border-wesup-ink bg-wesup-ink px-3 py-2 text-xs font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5">{order.presentation.primaryAction.label}</Link>;
  const capabilities = capabilitiesFor(order);
  if (capabilities.canPay) return <PaymentPageLink href={`/pesanan/${order.id}/bayar`} className="inline-flex min-h-11 items-center border border-wesup-ink bg-wesup-ink px-3 py-2 text-xs font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5">Bayar Sekarang</PaymentPageLink>;
  if (capabilities.canViewPickup && (order.status === "paid" || order.phase === "ready_for_pickup")) return <Link href={`/pesanan/${order.id}/serah-terima`} className="inline-flex min-h-11 items-center border border-wesup-ink/20 bg-wesup-paper px-3 py-2 text-xs font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub">Serah Terima</Link>;
  if (capabilities.canTrackDispute) return <Link href={`/pesanan/${order.id}/sengketa`} className="inline-flex min-h-11 items-center border border-wesup-red bg-wesup-paper px-3 py-2 text-xs font-semibold text-wesup-red transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub">Lacak Sengketa</Link>;
  if (capabilities.canComplain) return <Link href={`/pesanan/${order.id}/komplain`} className="inline-flex min-h-11 items-center border border-wesup-red bg-wesup-paper px-3 py-2 text-xs font-semibold text-wesup-red transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub">Ajukan Komplain</Link>;
  if (capabilities.canRate) return <Link href={`/pesanan/${order.id}/nilai`} className="inline-flex min-h-11 items-center border border-wesup-ink/20 bg-wesup-paper px-3 py-2 text-xs font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub">Nilai &amp; Ulas</Link>;
  if (capabilities.canSubmitRefundAccount) return <Link href={`/pesanan/${order.id}/refund/rekening`} className="inline-flex min-h-11 items-center border border-wesup-ink/20 bg-wesup-paper px-3 py-2 text-xs font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub">Isi Rekening Refund</Link>;
  return <span className="text-xs text-wesup-ink-sub/50" aria-hidden="true">—</span>;
}

function SummaryCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-wesup-paper p-4">
      <span aria-hidden="true" className="mb-3 flex size-8 items-center justify-center border border-wesup-ink/20 text-wesup-red">{icon}</span>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">{label}</p>
      <p className="mt-1 font-landing-display text-2xl uppercase tabular-nums tracking-[0.02em] text-wesup-ink">{value}</p>
    </div>
  );
}

export default function UmkmOrdersClient() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [summary, setSummary] = useState<OrderSummary>(EMPTY_SUMMARY);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorRequestId, setErrorRequestId] = useState("");
  const [retry, setRetry] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [nextCursor,setNextCursor]=useState<string|null>(null);

  const load = useCallback(async (signal: AbortSignal,cursor?:string) => {
    setLoading(true);
    setError("");
    setErrorRequestId("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      if(cursor) params.set("cursor",cursor);
      if (filter !== "all") params.set("group", filter);
      const response = await fetch(`/api/umkm/orders?${params.toString()}`, { cache: "no-store", signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorRequestId(typeof body.requestId === "string" ? body.requestId : "");
        throw new Error(body.error ?? "Pesanan belum dapat dimuat.");
      }
      if (signal.aborted) return;
      const rawOrders = Array.isArray(body.items) ? body.items : Array.isArray(body.orders) ? body.orders : [];
      setOrders(previous=>cursor?[...previous,...rawOrders.filter((row:ClientOrder)=>!previous.some(item=>item.id===row.id))]:rawOrders as ClientOrder[]);
      setNextCursor(typeof body.nextCursor==='string'?body.nextCursor:null);
      setSummary(body.summary ?? EMPTY_SUMMARY);
      setCounts(body.counts ?? {});
    } catch (reason: unknown) {
      if (signal.aborted || (reason instanceof Error && reason.name === "AbortError")) return;
      setError(feedbackError(reason, "Pesanan belum dapat dimuat."));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const controller = new AbortController();
    const task = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => { window.clearTimeout(task); controller.abort(); };
  }, [load, retry]);

  useEffect(() => {
    const refresh = () => setRetry(value => value + 1);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === "wesup:orders-updated") refresh(); };
    window.addEventListener("wesup:orders-updated", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("wesup:orders-updated", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 767px)");
    if (!media) return;
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const visibleOrders = useMemo(() => orders.filter((order) => filterMatches(order, filter)), [orders, filter]);
  const countFor = (key: FilterKey) => key === "cancelled" ? (counts.cancelled_group ?? counts.cancelled ?? 0) : key === "all" ? (counts.all ?? summary.total ?? orders.length) : key === "picked_up" ? (counts.picked_up ?? summary.pickedUp) : key === "refund" ? (counts.refund ?? summary.refund) : (counts[key] ?? orders.filter((order) => filterMatches(order, key)).length);

  if (loading && orders.length === 0) return <div className="space-y-4" role="status" aria-label="Memuat pesanan"><div className="grid grid-cols-2 gap-px bg-wesup-ink/10 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24" />)}</div><Skeleton className="h-14" /><Skeleton className="h-72" /></div>;
  if (error && orders.length === 0) return <section role="alert" className="border border-wesup-red bg-wesup-paper p-5 text-sm text-wesup-ink"><p>{error}</p>{errorRequestId && <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-wesup-ink-sub">Referensi: {errorRequestId}</p>}<button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 inline-flex min-h-11 items-center gap-2 border border-wesup-ink bg-wesup-ink px-3 py-2 font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red"><RefreshCw className="size-4" strokeWidth={1.5} aria-hidden="true" />Coba lagi</button></section>;
  if (!loading && visibleOrders.length === 0 && filter === "all") return <section className="border border-wesup-ink/15 bg-wesup-paper"><EmptyState heading="Belum ada pesanan" description="Pesanan yang Anda ikuti akan muncul di sini setelah Join Batch berhasil." action={<Link href="/marketplace" className="inline-flex min-h-11 items-center gap-3 border border-wesup-ink bg-wesup-ink px-4 py-2.5 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5">Jelajahi Marketplace<ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" /></Link>} /></section>;

  return <section aria-label="Daftar pesanan UMKM" className="space-y-6">
    <div className="grid grid-cols-2 gap-px border border-wesup-ink/10 bg-wesup-ink/10 lg:grid-cols-4">
      <SummaryCell icon={<ShoppingBag className="size-4" strokeWidth={1.5} />} label="Total Pesanan" value={summary.total || countFor("all")} />
      <SummaryCell icon={<Clock3 className="size-4" strokeWidth={1.5} />} label="Menunggu Bayar" value={summary.pendingPayment || countFor("pending_payment")} />
      <SummaryCell icon={<CheckCircle2 className="size-4" strokeWidth={1.5} />} label="Lunas" value={summary.paidReady || countFor("paid")} />
      <SummaryCell icon={<PackageCheck className="size-4" strokeWidth={1.5} />} label="Sudah Diambil" value={summary.pickedUp || countFor("picked_up")} />
    </div>
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter status pesanan">
      {FILTERS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={`whitespace-nowrap px-3 py-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] transition-colors duration-300 wesup-ease ${filter === item.key ? "bg-wesup-ink text-wesup-paper" : "border border-wesup-ink/20 bg-wesup-paper text-wesup-ink-sub hover:bg-wesup-paper-sub hover:text-wesup-ink"}`}>{item.label} <span className="tabular-nums opacity-70">({countFor(item.key)})</span></button>)}
    </div>
    {error && <p role="alert" className="border border-wesup-ink/20 bg-wesup-paper p-3 text-xs text-wesup-ink">{error}</p>}
    <div className="border border-wesup-ink/15 bg-wesup-paper">
      {!isMobile && <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-wesup-ink/15 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub"><tr><th className="px-4 py-3 font-medium">Batch</th><th className="px-4 py-3 font-medium">Mitra</th><th className="px-4 py-3 font-medium">Qty</th><th className="px-4 py-3 font-medium">Total</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Aksi</th></tr></thead><tbody className="divide-y divide-wesup-ink/10">{visibleOrders.map((order) => <tr key={order.id} className="align-middle"><td className="px-4 py-3"><PaymentPageLink href={`/umkm/pesanan/${order.id}`} className="font-semibold text-wesup-ink hover:underline">{order.batchTitle}</PaymentPageLink><p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">{order.batchDisplayCode}</p></td><td className="px-4 py-3 text-xs text-wesup-ink-sub">{order.supplierName ?? "Supplier"}</td><td className="px-4 py-3 font-semibold tabular-nums text-wesup-ink">{order.quantity} {order.unit}</td><td className="px-4 py-3 font-semibold tabular-nums text-wesup-ink">{order.finalAmount === null || order.finalAmount === undefined ? "Belum ditentukan" : money.format(order.finalAmount)}</td><td className="px-4 py-3"><StatusChip status={order.presentation?.label??order.status} /></td><td className="px-4 py-3 text-right"><ActionLinks order={order} /></td></tr>)}</tbody></table></div>}
      {isMobile && <div className="divide-y divide-wesup-ink/10">{visibleOrders.map((order) => <article key={order.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><PaymentPageLink href={`/umkm/pesanan/${order.id}`} className="font-semibold text-wesup-ink hover:underline"><span className="text-sm">{order.batchTitle}</span></PaymentPageLink><p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub"><span className="tabular-nums">{order.quantity} {order.unit}</span> · {order.supplierName ?? "Supplier"}</p></div><StatusChip status={order.presentation?.label??order.status} /></div><div className="flex items-center justify-between gap-3 text-sm"><span className="text-wesup-ink-sub">Total <strong className="tabular-nums text-wesup-ink">{order.finalAmount === null || order.finalAmount === undefined ? "—" : money.format(order.finalAmount)}</strong></span><ActionLinks order={order} /></div></article>)}</div>}
      </div>
    {!loading && visibleOrders.length === 0 && <p className="border border-wesup-ink/15 bg-wesup-paper p-8 text-center text-sm text-wesup-ink-sub">Tidak ada pesanan pada filter “{FILTERS.find((item) => item.key === filter)?.label}”.</p>}
    {nextCursor&&<button type="button" disabled={loading} onClick={()=>{void load(new AbortController().signal,nextCursor);}} className="min-h-11 border border-wesup-ink/20 bg-wesup-paper px-4 font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub">Muat pesanan berikutnya</button>}
    {loading && <p className="text-center font-mono text-xs uppercase tracking-[0.14em] text-wesup-ink-sub">Memperbarui pesanan…</p>}
    <div className="flex items-center justify-end gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub"><WalletCards className="size-4" strokeWidth={1.5} aria-hidden="true" />Nominal dan hak aksi ditentukan server.</div>
  </section>;
}
