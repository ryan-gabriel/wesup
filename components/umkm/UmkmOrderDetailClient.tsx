"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, MapPin, QrCode, ShieldAlert, ShieldCheck, Star, Upload } from "lucide-react";
import type { UmkmOrderDetail } from "@/lib/orders/api-types";
import { encodePickupQr } from "@/lib/supplier-fulfillment/qr-payload";
import PickupQrBlock from "@/components/orders/PickupQrBlock";
import { compressImage } from "@/lib/image-compression";
import type { MidtransSnapConfig } from "@/components/payments/MidtransSnapLoader";
import UmkmPaymentPanel from "@/components/payments/UmkmPaymentPanel";

import { Alert, AsyncButton, ContentSkeleton, ErrorState, Progress, SuccessState } from "@/components/feedback";
import { feedbackError } from "@/lib/feedback/errors";

import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";

import TransactionOverview from "@/components/orders/TransactionOverview";

export type UmkmOrderDetailMode = "overview" | "payment" | "pickup" | "complaint" | "dispute" | "rating" | "refund";

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
const statusLabel: Record<string, string> = { registered: "Terdaftar", pending_payment: "Menunggu Bayar", paid: "Lunas", picked_up: "Sudah Diambil", completed: "Selesai", no_show: "Tidak Hadir", cancelled: "Dibatalkan", refund_pending: "Proses Refund", refunded: "Refund Selesai" };

const eyebrow = "font-mono text-[0.6875rem] font-medium uppercase tracking-[0.24em] text-wesup-ink-sub";
const panel = "border border-wesup-ink/15 bg-wesup-paper";
const inputClass = "mt-1 w-full border border-wesup-ink/20 bg-wesup-paper px-4 py-2.5 text-sm text-wesup-ink caret-wesup-ink outline-none transition-colors duration-300 wesup-ease placeholder:text-wesup-ink-sub/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red";
const panelHeading = "font-landing-display text-lg uppercase tracking-[0.05em] text-wesup-ink";

function formatDate(value: string | null | undefined): string { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : dateTime.format(parsed); }
function apiError(body: unknown, fallback: string): string { return body && typeof body === "object" && "error" in body ? feedbackError((body as { error?: unknown }).error, fallback) : fallback; }

function useOrderDetail(orderId: string) {
  const [order, setOrder] = useState<UmkmOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasLoaded = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const current = ++generation.current;
    const initialLoad = !hasLoaded.current;
    if (initialLoad) setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/umkm/orders/${encodeURIComponent(orderId)}`, { cache: "no-store", signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Pesanan belum dapat dimuat."));
      if (signal?.aborted || current !== generation.current) return;
      setOrder(body as UmkmOrderDetail);
      hasLoaded.current = true;
    } catch (reason: unknown) {
      if (signal?.aborted || current !== generation.current || (reason instanceof Error && reason.name === "AbortError")) return;
      setError(feedbackError(reason, "Pesanan belum dapat dimuat."));
    } finally { if (initialLoad && !signal?.aborted && current === generation.current) setLoading(false); }
  }, [orderId]);
  useEffect(() => {
    hasLoaded.current = false;
    const counter = generation;
    const controller = new AbortController();
    const task = window.setTimeout(() => { void load(controller.signal); }, 0);
    const poll=window.setInterval(()=>{if(document.visibilityState==='visible')void load(controller.signal);},30_000);
    return () => { window.clearTimeout(task);window.clearInterval(poll); counter.current++; controller.abort(); };
  }, [load]);
  const reload = useCallback(() => { void load(); }, [load]);
  return { order, loading, error, reload };
}

function PageHeader({ order, mode }: { order: UmkmOrderDetail; mode: UmkmOrderDetailMode }) {
  const labels: Record<UmkmOrderDetailMode, string> = { overview:"Detail pesanan", payment: "Pembayaran Tagihan", pickup: "Serah Terima", complaint: "Ajukan Komplain", dispute: "Lacak Sengketa", rating: "Penilaian & Ulasan", refund: "Rekening Refund" };
  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em]">
        <Link href="/umkm/pesanan" className="inline-flex min-h-11 items-center gap-1 font-semibold text-wesup-ink underline decoration-wesup-ink/30 underline-offset-[6px] transition-colors duration-300 hover:decoration-wesup-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red"><ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />Pesanan</Link>
        <span className="text-wesup-ink-sub/40" aria-hidden="true">/</span>
        <span className="truncate text-wesup-ink-sub">{labels[mode]}</span>
      </nav>
      <header className="border-b border-wesup-ink/10 pb-6">
        <p className={`${eyebrow} inline-flex items-center gap-2`}><span aria-hidden="true" className="inline-block h-px w-6 bg-wesup-red" />{labels[mode]}</p>
        <h1 className="mt-4 font-landing-display text-3xl uppercase leading-[0.95] tracking-[0.06em] text-wesup-ink sm:text-4xl">{order.batchTitle}</h1>
        <dl className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">
          <div className="flex gap-1.5"><dt className="sr-only">Mitra</dt><dd>{order.supplierName}</dd></div>
          <div className="flex gap-1.5"><dt className="sr-only">Kode batch</dt><dd>{order.batchDisplayCode}</dd></div>
          <div className="flex gap-1.5"><dt className="sr-only">Kuantitas</dt><dd className="tabular-nums">{order.quantity} {order.unit}</dd></div>
        </dl>
      </header>
    </>
  );
}

function Summary({ order }: { order: UmkmOrderDetail }) {
  const rows: Array<[string, string]> = [
    ["Status", statusLabel[order.status] ?? order.status],
    ["Kuantitas", `${order.quantity} ${order.unit}`],
    ["Tier terkunci", order.lockedTier === null ? "Belum dikunci" : `Harga ${order.lockedTier}`],
    ["Total tagihan", order.finalAmount === null ? "Belum ditentukan" : money.format(order.finalAmount)],
  ];
  return (
    <section className={panel}>
      <header className="border-b border-wesup-ink/10 px-4 py-3 sm:px-5"><h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Ringkasan Pesanan</h2></header>
      <dl className="divide-y divide-wesup-ink/10">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-1 sm:grid-cols-[11rem_1fr]">
            <dt className="px-4 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub sm:px-5">{label}</dt>
            <dd className="px-4 py-3 text-sm font-semibold tabular-nums text-wesup-ink sm:border-l sm:border-wesup-ink/15 sm:px-5">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PickupPanel({ order }: { order: UmkmOrderDetail }) {
  const [pickup, setPickup] = useState(order.pickup);
  const [message, setMessage] = useState("");
  const generating = useRef(false);
  const [request, setRequest] = useState(0), [pending, setPending] = useState(false);
  useEffect(() => {
    if (order.status !== "paid" || !order.capabilities.canViewPickup || pickup?.qrCodeToken || pickup?.usedAt) return;
    let active = true; generating.current = true; queueMicrotask(() => { if (active) { setPending(true); setMessage(""); } });
    void fetch(`/api/pickups/${order.id}/code`, { method: "POST" }).then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiError(body, "Kode pengambilan belum dapat dimuat."));
      if (active) setPickup({ qrCodeToken: body.qrCodeToken, pinCode: body.pinCode, generatedAt: new Date().toISOString(), usedAt: null, address: order.pickup?.address ?? null });
    }).catch(reason => { if (active) setMessage(feedbackError(reason, "Kode pengambilan belum dapat dimuat.")); })
      .finally(() => { generating.current = false; if (active) setPending(false); });
    return () => { active = false; };
  }, [order.id, order.status, order.capabilities.canViewPickup, order.pickup?.address, pickup?.qrCodeToken, pickup?.usedAt, request]);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 3000); return () => window.clearTimeout(timer); }, [copied]);
  const copy = async () => { if (!pickup?.pinCode) return; try { await navigator.clipboard.writeText(pickup.pinCode); setCopied(true); } catch { setMessage("PIN belum tersalin. Anda tetap bisa menunjukkan PIN di layar."); } };
  if (!order.capabilities.canViewPickup) return <section className={`${panel} p-6 text-center text-sm text-wesup-ink-sub`}>{order.presentation?.blockedReason ?? "Kode QR dan PIN tersedia setelah pembayaran lunas."}</section>;
  if (["picked_up", "completed"].includes(order.status) || pickup?.usedAt) return <SuccessState title="Serah terima selesai" description="Pesanan sudah diambil. Kode QR dan PIN telah digunakan." />;
  const deadline = order.timeline.pickupDeadlineAt;
  return (
    <div className="space-y-6">
      <div className="grid gap-px border border-wesup-ink/10 bg-wesup-ink/10 lg:grid-cols-2">
        <section className="bg-wesup-paper p-5">
          <h2 className={`${panelHeading} flex items-center gap-2`}><QrCode className="size-5 text-wesup-red" strokeWidth={1.5} aria-hidden="true" />Kode QR Pengambilan</h2>
          <p className="mt-1 text-xs leading-5 text-wesup-ink-sub">Perlihatkan kode ini ke Supplier saat tiba di titik kumpul.</p>
          {pickup?.qrCodeToken ? <div className="mt-4"><PickupQrBlock seed={encodePickupQr(order.id, pickup.qrCodeToken)} /></div> : pending ? <ContentSkeleton variant="detail" label="Menyiapkan kode pengambilan…" /> : <ErrorState title="Kode belum dapat dimuat." description={message || "Coba periksa kode pengambilan kembali."} action={<AsyncButton onClick={() => setRequest(value => value + 1)}>Coba lagi</AsyncButton>} />}
        </section>
        <section className="bg-wesup-paper p-5">
          <h2 className={`${panelHeading} flex items-center gap-2`}><ShieldCheck className="size-5 text-wesup-ink-sub" strokeWidth={1.5} aria-hidden="true" />PIN 4-digit Cadangan</h2>
          <p className="mt-1 text-xs leading-5 text-wesup-ink-sub">Gunakan jika kamera Supplier bermasalah.</p>
          {pickup?.pinCode ? (
            <>
              <div className="mt-5 grid grid-cols-4 gap-2 border-y border-wesup-ink/15 py-4">{pickup.pinCode.split("").map((digit, index) => <span key={`${digit}-${index}`} className="border border-wesup-ink/20 bg-wesup-paper-sub py-3 text-center font-mono text-2xl font-black tabular-nums text-wesup-ink">{digit}</span>)}</div>
              <button type="button" onClick={() => void copy()} className="mt-4 inline-flex min-h-11 items-center gap-2 border border-wesup-ink/20 bg-wesup-paper px-3 py-2 text-xs font-semibold text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub">{copied ? <CheckCircle2 className="size-4 text-wesup-red" strokeWidth={1.5} /> : <Copy className="size-4" strokeWidth={1.5} />}{copied ? "PIN tersalin" : "Salin PIN"}</button>
            </>
          ) : <p className="mt-5 text-sm text-wesup-ink-sub">PIN belum tersedia.</p>}
        </section>
      </div>
      <section className={`${panel} p-5`}>
        <h2 className={`${panelHeading} flex items-center gap-2`}><MapPin className="size-5 text-wesup-ink-sub" strokeWidth={1.5} aria-hidden="true" />Lokasi &amp; Jendela Pengambilan</h2>
        <p className="mt-3 text-sm leading-6 text-wesup-ink">{order.pickupAddress ?? pickup?.address ?? "Alamat pickup belum tersedia."}</p>
        <dl className="mt-4 grid grid-cols-2 gap-px border border-wesup-ink/10 bg-wesup-ink/10 sm:grid-cols-[11rem_1fr]">
          <div className="bg-wesup-paper px-3 py-2"><dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">Batas pengambilan</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-wesup-ink">{formatDate(deadline)} WIB</dd></div>
          <div className="bg-wesup-paper px-3 py-2"><dt className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-wesup-ink-sub">Status kode</dt><dd className="mt-1 text-sm font-semibold text-wesup-ink">{pickup?.usedAt ? "Sudah dipakai" : pickup?.qrCodeToken ? "Aktif" : "Belum diterbitkan"}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function ComplaintPanel({ order }: { order: UmkmOrderDetail }) {
  const [category, setCategory] = useState<"cacat" | "busuk">("cacat"); const [description, setDescription] = useState(""); const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [prepared, setPrepared] = useState<number | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (files.length < 1) { setMessage("Unggah minimal satu foto bukti."); return; } setBusy(true); setMessage(""); setPrepared(0); try { const compressed: File[] = []; for (const [index, file] of files.entries()) { setMessage(`Mengompresi foto ${index + 1} dari ${files.length}…`); try { const result = await compressImage(file, { outputType: "image/webp" }); compressed.push(new File([result.blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" })); } catch { compressed.push(file); } setPrepared(index + 1); } const form = new FormData(); form.set("category", category); form.set("description", description); compressed.forEach((file) => form.append("photos", file)); setMessage("Mengirim komplain…"); const response = await fetch(`/api/umkm/orders/${order.id}/complaints`, { method: "POST", body: form }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(body, "Komplain belum dapat diajukan.")); window.location.assign(`/pesanan/${order.id}/sengketa`); } catch (reason: unknown) { setMessage(feedbackError(reason, "Hasil pengiriman belum terkonfirmasi. Periksa detail pesanan sebelum mengirim ulang; bukti Anda tetap tersedia.")); } finally { setBusy(false); setPrepared(null); } };
  if (!order.capabilities.canComplain) return <section role="status" className="border border-wesup-ink/20 bg-wesup-paper p-5 text-sm text-wesup-ink-sub"><ShieldAlert className="mr-2 inline size-4 text-wesup-red" strokeWidth={1.5} aria-hidden="true" />Jendela komplain belum terbuka atau sudah ditutup.</section>;
  return (
    <form onSubmit={submit} className={`${panel} space-y-6 p-5`}>
      <div>
        <h2 className={panelHeading}>Jenis Komplain</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{(["cacat", "busuk"] as const).map((value) => <label key={value} className={`flex cursor-pointer items-center gap-2 border p-3 text-sm font-semibold transition-colors duration-300 wesup-ease ${category === value ? "border-wesup-red bg-wesup-paper-sub text-wesup-ink" : "border-wesup-ink/15 bg-wesup-paper text-wesup-ink-sub hover:bg-wesup-paper-sub"}`}><input type="radio" name="category" value={value} checked={category === value} onChange={() => setCategory(value)} className="size-4 accent-wesup-red" />Barang {value}</label>)}</div>
      </div>
      <label className="block"><span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Deskripsi kondisi (opsional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2_000} rows={4} className={inputClass} placeholder="Ceritakan kondisi barang saat diterima." /></label>
      <label className="block border border-dashed border-wesup-ink/30 bg-wesup-paper-sub p-6 text-center text-sm text-wesup-ink-sub"><Upload className="mx-auto mb-2 size-6 text-wesup-red" strokeWidth={1.5} aria-hidden="true" /><span className="font-semibold text-wesup-ink">Unggah bukti foto</span><span className="mt-1 block text-xs text-wesup-ink-sub">JPEG, PNG, atau WebP · 1–5 foto · kompresi otomatis</span><input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} className="mx-auto mt-3 block max-w-full text-xs" /></label>
      {busy && prepared !== null && <Progress value={prepared} max={files.length} label="Menyiapkan foto" />}
      {message && <p role="alert" className="text-sm text-wesup-red">{message}</p>}
      <AsyncButton type="submit" pending={busy} pendingLabel={prepared !== null ? "Menyiapkan foto…" : "Mengirim komplain…"} className="w-full">{busy ? "Memproses…" : "Ajukan Komplain & Bekukan Dana"}</AsyncButton>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">Komplain membekukan dana escrow selama pemeriksaan Admin.</p>
    </form>
  );
}

function DisputePanel({ order }: { order: UmkmOrderDetail }) {
  if (!order.dispute) return <section className={`${panel} p-6 text-center text-sm text-wesup-ink-sub`}>Belum ada sengketa untuk pesanan ini.</section>;
  const winningUmkm = order.dispute.status === "resolved_umkm";
  return (
    <div className="space-y-6">
      <section role="status" className="relative border border-wesup-red bg-wesup-paper p-5 pl-6 text-sm text-wesup-ink">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-wesup-red" />
        <ShieldAlert className="mr-2 inline size-5 text-wesup-red" strokeWidth={1.5} aria-hidden="true" />{order.dispute.decidedAt ? "Keputusan Admin tersedia. Status dana mengikuti hasil pemeriksaan." : "Komplain sedang ditinjau Admin. Dana dibekukan selama pemeriksaan."}
      </section>
      <section className={panel}>
        <header className="border-b border-wesup-ink/10 px-4 py-3 sm:px-5"><h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Perjalanan Sengketa</h2></header>
        <ol className="space-y-5 p-5 text-sm">
          <li className="relative border-l-2 border-wesup-ink/15 pl-5"><span aria-hidden="true" className="absolute -left-[5px] top-1.5 size-2 bg-wesup-red" /><strong className="text-wesup-ink">Komplain diajukan</strong><p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">Kategori: {order.dispute.complaintCategory}. {formatDate(order.dispute.createdAt)}</p></li>
          <li className="relative border-l-2 border-wesup-ink/15 pl-5"><span aria-hidden="true" className="absolute -left-[5px] top-1.5 size-2 bg-wesup-ink/40" /><strong className="text-wesup-ink">Ditinjau Arbiter</strong><p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">Admin meninjau bukti foto dan kronologi.</p></li>
          <li className="relative border-l-2 border-transparent pl-5"><span aria-hidden="true" className={`absolute -left-[5px] top-1.5 size-2 ${winningUmkm ? "bg-wesup-red" : "bg-wesup-ink/20"}`} /><strong className={winningUmkm ? "text-wesup-ink" : "text-wesup-ink-sub"}>Keputusan</strong><p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">{order.dispute.decidedAt ? formatDate(order.dispute.decidedAt) : "Menunggu keputusan final."}</p></li>
        </ol>
      </section>
      <section className={panel}>
        <header className="border-b border-wesup-ink/10 px-4 py-3 sm:px-5"><h2 className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Bukti Komplain</h2></header>
        <div className="p-5">
          <p className="text-sm leading-6 text-wesup-ink-sub">{order.dispute.description || "Tidak ada deskripsi tambahan."}</p>
          {order.dispute.photoUrls.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{order.dispute.photoUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="border border-wesup-ink/20 bg-wesup-paper p-3 text-center font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-wesup-ink transition-colors duration-500 wesup-ease hover:bg-wesup-paper-sub">Lihat foto</a>)}</div>}
        </div>
      </section>
      {winningUmkm && order.capabilities.canSubmitRefundAccount && <Link href={`/pesanan/${order.id}/refund/rekening`} className="inline-flex min-h-12 items-center border border-wesup-ink bg-wesup-ink px-6 py-3 text-sm font-semibold text-wesup-paper transition-all duration-500 wesup-ease hover:border-wesup-red hover:bg-wesup-red hover:translate-x-0.5">Isi rekening refund</Link>}
    </div>
  );
}

function RatingPanel({ order, onReload }: { order: UmkmOrderDetail; onReload: () => void }) {
  const [succeeded, setSucceeded] = useState(false);
  const [score, setScore] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  if (succeeded) return <SuccessState title="Ulasan tersimpan." description="Terima kasih sudah menilai pesanan ini." />;
  if (order.rating) return <section role="status" className="border border-wesup-ink/20 bg-wesup-paper-sub p-5 text-sm text-wesup-ink"><Star className="mr-2 inline size-4 text-wesup-red" strokeWidth={1.5} aria-hidden="true" />Anda sudah memberi rating <span className="tabular-nums">{order.rating.score}/5</span> pada {formatDate(order.rating.createdAt)}.</section>;
  if (!order.capabilities.canRate) return <section className={`${panel} p-6 text-center text-sm text-wesup-ink-sub`}>Rating tersedia setelah serah terima selesai dan tidak berlaku untuk No-Show.</section>;
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!score) { setMessage("Pilih rating bintang terlebih dahulu."); return; } setBusy(true); setMessage(""); try { const response = await fetch(`/api/umkm/orders/${order.id}/ratings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score, comment: comment || null }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(body, "Rating belum dapat dikirim.")); setSucceeded(true); onReload(); } catch (reason: unknown) { setMessage(feedbackError(reason, "Hasil pengiriman ulasan belum terkonfirmasi. Periksa detail sebelum mengirim ulang.")); } finally { setBusy(false); } };
  return (
    <form onSubmit={submit} className={`${panel} space-y-6 p-5`}>
      <div>
        <h2 className={panelHeading}>Berikan Rating Bintang</h2>
        <p className="mt-1 text-xs leading-5 text-wesup-ink-sub">Bagaimana kualitas layanan {order.supplierName}?</p>
        <div className="mt-4 flex gap-1" role="radiogroup" aria-label="Rating bintang">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} bintang`} aria-pressed={score === value} onClick={() => setScore(value)} className={`flex size-11 items-center justify-center border transition-colors duration-300 wesup-ease focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wesup-red ${value <= score ? "border-wesup-red text-wesup-red" : "border-wesup-ink/20 text-wesup-ink-sub/40 hover:text-wesup-ink-sub"}`}><Star className="size-6" fill={value <= score ? "currentColor" : "none"} strokeWidth={1.5} aria-hidden="true" /></button>)}</div>
        <p role="status" aria-live="polite" className="mt-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-wesup-ink-sub">{score ? `${score} dari 5 bintang` : "Belum ada bintang dipilih"}</p>
      </div>
      <label className="block"><span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Ulasan (opsional)</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={1_000} className={inputClass} placeholder="Ceritakan pengalaman Anda mengenai kualitas produk dan pelayanan." /></label>
      {message && <p role="alert" className="text-sm text-wesup-red">{message}</p>}
      <AsyncButton type="submit" pending={busy} pendingLabel="Mengirim ulasan…" className="w-full">{busy ? "Mengirim…" : "Kirim Penilaian"}</AsyncButton>
    </form>
  );
}

function RefundPanel({ order, onReload }: { order: UmkmOrderDetail; onReload: () => void }) {
  const [confirm, setConfirm] = useState(false), [saved, setSaved] = useState(false);
  const [bankName, setBankName] = useState(""); const [accountNumber, setAccountNumber] = useState(""); const [accountHolderName, setAccountHolderName] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  if (!order.capabilities.canSubmitRefundAccount && !order.refund) return <section className={`${panel} p-6 text-center text-sm text-wesup-ink-sub`}>Rekening refund hanya dapat diisi ketika pesanan memiliki tiket refund.</section>;
  const save = async () => { if (busy) return; setBusy(true); setMessage(""); try { const response = await fetch(`/api/umkm/orders/${order.id}/refund-account`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bankName, accountNumber, accountHolderName }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(body, "Rekening refund belum dapat disimpan.")); setSaved(true); setConfirm(false); onReload(); } catch (reason: unknown) { setMessage(feedbackError(reason, "Rekening refund belum dapat disimpan. Isian Anda tetap tersedia.")); } finally { setBusy(false); } };
  if (saved) return <SuccessState title="Rekening pengembalian dana tersimpan." description="Pengembalian dana mengikuti status server. Penyimpanan rekening belum berarti dana telah ditransfer." />;
  return (
    <form onSubmit={event => { event.preventDefault(); setMessage(""); if (order.refund?.bankAccountId) setConfirm(true); else void save(); }} className={`${panel} space-y-4 p-5`}>
      <h2 className={panelHeading}>Rekening Pengembalian Dana</h2>
      <p className="text-sm leading-6 text-wesup-ink-sub">Transfer refund dilakukan manual oleh Admin setelah rekening terverifikasi.</p>
      <label className="block"><span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Nama bank</span><input required value={bankName} onChange={(event) => setBankName(event.target.value)} className={inputClass} /></label>
      <label className="block"><span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Nomor rekening</span><input required inputMode="numeric" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className={`${inputClass} tabular-nums`} /></label>
      <label className="block"><span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-wesup-ink-sub">Nama pemilik rekening</span><input required value={accountHolderName} onChange={(event) => setAccountHolderName(event.target.value)} className={inputClass} /></label>
      {message && !confirm && <p role="alert" className="text-sm text-wesup-red">{message}</p>}
      <AsyncButton type="submit" pending={busy} pendingLabel="Menyimpan rekening…" className="w-full">{busy ? "Menyimpan…" : "Simpan Rekening"}</AsyncButton>
      <ConfirmDialog open={confirm} title="Ganti rekening pengembalian dana?" description={`${bankName} · ${accountNumber} · ${accountHolderName}. Pastikan penerima sudah benar sebelum menyimpan.`} pending={busy} error={message} onConfirm={() => void save()} onCancel={() => setConfirm(false)} />
    </form>
  );
}

export default function UmkmOrderDetailClient({ orderId, mode, snapConfig }: { orderId: string; mode: UmkmOrderDetailMode; snapConfig?: MidtransSnapConfig }) {
  const { order, loading, error, reload } = useOrderDetail(orderId);
  if (loading || (order && order.id !== orderId && !error)) return <ContentSkeleton variant="detail" label="Memuat detail pesanan…" />;
  if ((error && (!order || order.id !== orderId)) || !order) return <ErrorState title="Pesanan tidak ditemukan." description={error || "Muat ulang untuk mencoba lagi."} action={<AsyncButton onClick={reload}>Coba lagi</AsyncButton>} />;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <PageHeader order={order} mode={mode} />
      {error && <Alert tone="warning" action={<AsyncButton onClick={reload}>Coba lagi</AsyncButton>}>Detail terakhir ditampilkan; pembaruan belum berhasil.</Alert>}
      {mode === "overview" && <TransactionOverview order={order} onReload={reload}>{!order.invoice && <Summary order={order}/>} {(order.invoice || ["waiting_payment_window","payment_open","payment_verifying","payment_expired"].includes(order.phase)) && <UmkmPaymentPanel key={order.id} order={order} onReload={reload} snapConfig={snapConfig}/>} {order.phase === "ready_for_pickup" && <PickupPanel key={`${order.id}:${order.status}:${order.pickup?.usedAt ?? ""}`} order={order}/>} {order.capabilities.canSubmitRefundAccount && <RefundPanel order={order} onReload={reload}/>} {order.capabilities.canTrackDispute && <DisputePanel order={order}/>} {(order.capabilities.canComplain || order.capabilities.canRate) && <details className={`${panel} p-4`}><summary className="cursor-pointer text-sm font-semibold text-wesup-ink">Periksa barang, ulasan, dan komplain</summary><div className="mt-4 space-y-5">{order.capabilities.canComplain && <ComplaintPanel order={order}/>} {order.capabilities.canRate && <RatingPanel order={order} onReload={reload}/>}</div></details>}</TransactionOverview>}
      {mode === "payment" && <UmkmPaymentPanel key={order.id} order={order} onReload={reload} snapConfig={snapConfig} />}
      {mode === "pickup" && <PickupPanel key={`${order.id}:${order.status}:${order.pickup?.usedAt ?? ""}`} order={order} />}
      {mode === "complaint" && <><Summary order={order} /><ComplaintPanel order={order} /></>}
      {mode === "dispute" && <><Summary order={order} /><DisputePanel order={order} /></>}
      {mode === "rating" && <><Summary order={order} /><RatingPanel order={order} onReload={reload} /></>}
      {mode === "refund" && <><Summary order={order} /><RefundPanel order={order} onReload={reload} /></>}
    </div>
  );
}
