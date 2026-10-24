"use client";

import Link from "@/components/supplier/fulfillment/FulfillmentLink";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Package, ScanLine, Truck } from "lucide-react";
import { supplierCatalogApiRepository } from "@/lib/supplier-catalog/api-repository";
import { SupplierApiError } from "@/lib/supplier-catalog/api-error";
import type { SupplierBatchTransactionSnapshot, SupplierTransactionOrder } from "@/lib/supplier-batch/transaction-types";

import { formatTransactionDate } from "@/lib/transactions/schedule";
import EarlyPaymentPanel from "./EarlyPaymentPanel";
import PickupReplacementForm from "./PickupReplacementForm";
import TransactionSupport from "@/components/orders/TransactionSupport";

import { ContentSkeleton } from "@/components/feedback";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { feedbackError } from "@/lib/feedback/errors";
import SupplierBatchDetailClient from "./SupplierBatchDetailClient";

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dates = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
const labels: Record<string, string> = { registered: "Terdaftar", pending_payment: "Menunggu Bayar", paid: "Lunas", picked_up: "Diambil", completed: "Selesai", no_show: "Tidak Hadir", cancelled: "Dibatalkan", refund_pending: "Refund", refunded: "Refund Selesai" };

export default function SupplierBatchTransactionCenter({ batchId }: { batchId: string }) {
  const read = useRef<{ controller: AbortController | null; generation: number }>({ controller: null, generation: 0 });
  const [confirm, setConfirm] = useState<"close" | "ready" | null>(null);
  const [snapshot, setSnapshot] = useState<SupplierBatchTransactionSnapshot | null>(null);
  const [filter, setFilter] = useState("all");
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "mutating">("loading");
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  const captureError = (reason: unknown, fallback: string) => {
    setError(feedbackError(reason, fallback));
    setErrorRequestId(reason instanceof SupplierApiError ? reason.requestId : null);
  };


  const load = () => {
    read.current.controller?.abort();
    const controller = new AbortController();
    const generation = ++read.current.generation;
    read.current.controller = controller;
    if (!snapshot) setPhase("loading"); setError(null); setErrorRequestId(null);
    void supplierCatalogApiRepository.getTransaction(batchId, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted && generation === read.current.generation) { setSnapshot(value); setPhase("ready"); } })
      .catch((reason: unknown) => { if (!controller.signal.aborted && generation === read.current.generation) { captureError(reason, "Transaksi belum dapat dimuat."); setPhase(snapshot ? "ready" : "error"); } });
  };
  useEffect(() => {
    const state = read.current;
    const controller = new AbortController();
    const generation = ++state.generation;
    state.controller = controller;
    void supplierCatalogApiRepository.getTransaction(batchId, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted && generation === state.generation) { setSnapshot(value); setPhase("ready"); } })
      .catch((reason: unknown) => { if (!controller.signal.aborted && generation === state.generation) { captureError(reason, "Transaksi belum dapat dimuat."); setPhase("error"); } });
    return () => { state.generation++; state.controller?.abort(); };
  }, [batchId]);

  const batch = snapshot?.batch ?? {};
  const status = String(batch.status ?? "published");
  const visible = useMemo(() => !snapshot ? [] : snapshot.orders.filter((order) => filter === "all" || (filter === "picked_up" ? ["picked_up", "completed"].includes(order.status) : filter === "failed" ? ["cancelled", "no_show"].includes(order.status) : filter === "refund" ? ["refund_pending", "refunded"].includes(order.status) : order.status === filter)), [snapshot, filter]);
  const capacity = snapshot?.capacityQuantity ?? null;
  const totalQuantity = snapshot?.summary.totalQuantity ?? 0;
  const minQuantity = Number(batch.min_quantity ?? 0);
  const progress = capacity ? Math.min(100, totalQuantity / capacity * 100) : minQuantity ? Math.min(100, totalQuantity / minQuantity * 100) : 0;
  const context=snapshot?.offerContext;
  const replacement=context?.replacements[0];
  const pickupStart=replacement?.starts_at??context?.pickupStartsAt;
  const actualReady=replacement?replacement.ready_at:context?.readyAt;
  const delayed=context?.policyVersion===2&&pickupStart&&Date.parse(snapshot?.serverTime??'')>=Date.parse(pickupStart)&&(!actualReady||Date.parse(actualReady)>Date.parse(pickupStart));
  const canClose = !snapshot?.offerContext?.earlyPayment?.minimumQuantity && !snapshot?.offerContext?.earlyPayment?.proposal && (snapshot?.capabilities.canCloseBatch ?? false);

  const mutate = async (operation: () => Promise<unknown>) => { setPhase("mutating"); setError(null); setErrorRequestId(null); try { await operation(); setConfirm(null); setPhase("ready"); load(); } catch (reason) { setPhase("ready"); captureError(reason, "Aksi belum dapat diproses."); } };

  if (phase === "loading" && !snapshot) return <ContentSkeleton label="Memuat transaksi batch…" variant="table" />;
  if (phase === "error" || !snapshot) return <section className=" border border-wesup-red/40 bg-wesup-paper p-10 text-center"><AlertCircle className="mx-auto text-wesup-red" /><p className="mt-3 text-sm text-wesup-red">{error ?? "Transaksi belum dapat dimuat."}</p>{errorRequestId && <p className="mt-2 text-xs text-wesup-ink-sub">Referensi: {errorRequestId}</p>}<button type="button" onClick={load} className="mt-4  bg-wesup-ink px-4 py-2 text-sm font-semibold text-wesup-paper">Coba lagi</button></section>;

  const filterItems = [["all", "Semua", snapshot.orders.length], ["registered", "Terdaftar", snapshot.summary.registered], ["pending_payment", "Menunggu Bayar", snapshot.summary.pendingPayment], ["paid", "Lunas", snapshot.summary.paid], ["picked_up", "Diambil", snapshot.summary.pickedUp], ["failed", "Gagal", snapshot.summary.failed], ["refund", "Refund", snapshot.summary.refund]] as const;
  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><Link href="/supplier/catalog" className="inline-flex min-h-11 items-center text-sm font-semibold text-wesup-ink-sub hover:text-wesup-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red">← Kembali ke katalog</Link><h1 className="mt-2 text-2xl font-bold text-wesup-ink">Transaksi {String(batch.title ?? "Batch")}</h1><p className="text-sm text-wesup-ink-sub">Status batch: <strong>{statusLabel(status)}</strong> · Server {dates.format(new Date(snapshot.serverTime))}</p></div><div className="flex flex-wrap gap-2">{canClose && <button type="button" disabled={phase === "mutating"} onClick={() => { setError(null); setConfirm("close"); }} className=" bg-wesup-ink px-4 py-2.5 text-sm font-semibold text-wesup-paper disabled:opacity-50">Tutup &amp; Terbitkan Tagihan</button>}{snapshot.capabilities.canMarkReady && <button type="button" disabled={phase === "mutating"} onClick={() => { setError(null); setConfirm("ready"); }} className="inline-flex items-center gap-2  border border-wesup-ink px-4 py-2.5 text-sm font-semibold text-wesup-ink disabled:opacity-50"><CheckCircle2 size={16} /> Barang siap diambil</button>}{snapshot.capabilities.canConfirmPickup && <Link href={`/supplier/batch/${batchId}/pickup`} className="inline-flex items-center gap-2  border border-wesup-ink/15 px-4 py-2.5 text-sm font-semibold text-wesup-ink"><ScanLine size={16} /> Layani pengambilan</Link>}</div></div>
    <Link href={`/supplier/catalog/new?copy=${batchId}`} className="inline-block min-h-11 text-sm font-semibold text-wesup-ink">Buat penawaran serupa</Link>
    {context?.policyVersion===2&&<section className="space-y-3  border border-wesup-ink/20 bg-wesup-paper-sub p-5"><h2 className="font-bold">{status==='published'?'Kumpulkan pesanan':Date.parse(snapshot.serverTime)<Date.parse(context.paymentClosesAt)?'Tunggu pembayaran':delayed?'Tangani keterlambatan':!actualReady?'Siapkan barang':'Layani pengambilan sesuai jadwal'}</h2><p className="text-sm">Pembayaran: {formatTransactionDate(context.paymentOpensAt)} – {formatTransactionDate(context.paymentClosesAt)}. Jadwal pengambilan tetap. Waktu pembayaran mengikuti penutupan aktual sesuai kebijakan penawaran.</p><p className="text-sm">Pengambilan: {formatTransactionDate(pickupStart)} – {formatTransactionDate(replacement?.ends_at??context.pickupEndsAt)}.</p><p className="text-sm">{actualReady?'Kesiapan dikonfirmasi '+formatTransactionDate(actualReady):'Kesiapan belum dikonfirmasi. UMKM belum boleh datang.'} Konfirmasi lebih awal tidak memajukan periode pengambilan.</p><p className="text-sm font-semibold">Jumlah pemenuhan: {snapshot.orders.filter(o=>o.status==='paid'||o.status==='picked_up'||o.status==='completed').reduce((sum,o)=>sum+o.quantity,0)} {String(batch.unit??'unit')} dari pesanan lunas.</p></section>}
    {status === "published" && context?.earlyPayment && <EarlyPaymentPanel key={`${context.earlyPayment.minimumQuantity}:${context.earlyPayment.proposal?.id ?? "none"}`} batchId={batchId} capacity={capacity ?? minQuantity} unit={String(batch.unit ?? "pcs")} context={context.earlyPayment} onReload={load} />}
    {delayed&&snapshot.orders.some(o=>o.status==='paid')&&<PickupReplacementForm batchId={batchId} onSaved={load}/>}
    {error && !confirm && <p role="alert" className=" border border-wesup-red/40 bg-wesup-paper px-4 py-3 text-sm text-wesup-red">{error}{errorRequestId && <span className="mt-1 block text-xs text-wesup-ink-sub">Referensi: {errorRequestId}</span>}</p>}

    <SupplierBatchDetailClient batchId={batchId} />

    <section className=" border border-wesup-ink/15 bg-wesup-paper p-5 "><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-wesup-ink-sub">Kapasitas batch</p><p className="mt-1 text-2xl font-bold text-wesup-ink">{totalQuantity.toLocaleString("id-ID")} / {capacity ? capacity.toLocaleString("id-ID") : "∞"} {String(batch.unit ?? "pcs")}</p></div><Package className="text-wesup-red" /></div><div className="mt-3 h-3 overflow-hidden  bg-wesup-paper-sub"><div className="h-full  bg-wesup-ink transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-3 grid gap-3 text-sm text-wesup-ink-sub sm:grid-cols-4"><Metric label="Terdaftar" value={snapshot.summary.registered} /><Metric label="Menunggu bayar" value={snapshot.summary.pendingPayment} /><Metric label="Lunas" value={snapshot.summary.paid} /><Metric label="Diambil" value={snapshot.summary.pickedUp} /></div></section>
    <TransactionSupport batchId={batchId}/>
    <section className="flex flex-wrap gap-1  border border-wesup-ink/15 bg-wesup-paper p-1">{filterItems.map(([key, label, count]) => <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key} className={` px-3 py-2 text-xs font-semibold ${filter === key ? "bg-wesup-ink text-wesup-paper" : "text-wesup-ink-sub hover:bg-wesup-paper-sub"}`}>{label} <span className="opacity-70">({count})</span></button>)}</section>
    {visible.length === 0 ? <section className=" border border-dashed border-wesup-ink/15 bg-wesup-paper p-10 text-center text-sm text-wesup-ink-sub">Belum ada pesanan pada filter ini.</section> : <section className="overflow-hidden  border border-wesup-ink/15 bg-wesup-paper "><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-wesup-paper text-xs text-wesup-ink-sub"><tr><th className="px-4 py-3">UMKM</th><th className="px-4 py-3">Kuantitas</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aksi</th></tr></thead><tbody className="divide-y divide-wesup-ink/10">{visible.map((order) => <OrderRow key={order.registrationId} order={order} batchId={batchId} />)}</tbody></table></div><div className="divide-y divide-wesup-ink/10 md:hidden">{visible.map((order) => <OrderCard key={order.registrationId} order={order} batchId={batchId} />)}</div></section>}
    <ConfirmDialog open={Boolean(confirm)} title={confirm === "close" ? "Tutup pengumpulan dan kunci harga final?" : "Barang untuk pesanan lunas sudah siap?"} description={confirm === "close" ? `${snapshot.orders.length} pesanan, ${totalQuantity} ${String(batch.unit ?? "unit")}. Harga final dikunci dan pembayaran dibuka sesuai kebijakan penawaran.` : "Konfirmasi kesiapan untuk seluruh pesanan lunas. Konfirmasi lebih awal tidak memajukan jadwal pengambilan."} pending={phase === "mutating"} error={error} onCancel={() => setConfirm(null)} onConfirm={() => void mutate(() => confirm === "close" ? supplierCatalogApiRepository.close(batchId) : supplierCatalogApiRepository.markReady(batchId))} />
  </div>;
}

function statusLabel(status: string) { return labels[status] ?? status; }
function Metric({ label, value }: { label: string; value: number }) { return <div><p className="text-xs text-wesup-ink-sub">{label}</p><p className="font-bold text-wesup-ink">{value.toLocaleString("id-ID")}</p></div>; }
function OrderRow({ order, batchId }: { order: SupplierTransactionOrder; batchId: string }) { return <tr><td className="px-4 py-3"><p className="font-semibold text-wesup-ink">{order.umkmName}</p><p className="text-xs text-wesup-ink-sub">{order.createdAt ? dates.format(new Date(order.createdAt)) : "—"}</p></td><td className="px-4 py-3">{order.quantity} unit</td><td className="px-4 py-3 font-semibold">{order.finalAmount == null ? "—" : money.format(order.finalAmount)}</td><td className="px-4 py-3"><Status status={order.status} /></td><td className="px-4 py-3">{order.status === "paid" && order.canConfirmPickup !== false && <Link href={`/supplier/batch/${batchId}/pickup?reg=${order.registrationId}`} className="inline-flex items-center gap-1  bg-wesup-paper-sub px-3 py-1.5 text-xs font-semibold text-wesup-ink"><Truck size={14} /> Pickup</Link>}</td></tr>; }
function OrderCard({ order, batchId }: { order: SupplierTransactionOrder; batchId: string }) { return <div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-wesup-ink">{order.umkmName}</p><p className="text-xs text-wesup-ink-sub">{order.quantity} unit · {order.finalAmount == null ? "—" : money.format(order.finalAmount)}</p></div><Status status={order.status} /></div>{order.status === "paid" && order.canConfirmPickup !== false && <Link href={`/supplier/batch/${batchId}/pickup?reg=${order.registrationId}`} className="mt-3 inline-flex items-center gap-1  bg-wesup-paper-sub px-3 py-1.5 text-xs font-semibold text-wesup-ink"><Truck size={14} /> Pickup</Link>}</div>; }
function Status({ status }: { status: string }) { return <span className="inline-flex  bg-wesup-paper-sub px-2.5 py-1 text-xs font-semibold text-wesup-ink">{statusLabel(status)}</span>; }
