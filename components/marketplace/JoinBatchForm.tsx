"use client";

import { FormEvent, useState, useEffect } from "react";
import Link from "next/link";
import { readApiError } from "@/lib/marketplace/api-repository";
import { feedbackError } from "@/lib/feedback/errors";
import type { MarketplaceItem, MarketplaceProgressResponse, ViewerRegistration } from "@/lib/marketplace/types";

import { useRouter } from "next/navigation";
import { formatTransactionDate } from "@/lib/transactions/schedule";

interface ViewerLocation {
  latitude: number;
  longitude: number;
}

interface RegistrationResult {
  count: number;
  registrationId: string;
}

export interface JoinBatchFormProps {
  item: MarketplaceItem;
  consentGiven: boolean;
  viewerLocation?: ViewerLocation | null;
  /** Registration already recorded for this viewer; rendered instead of a fresh join. */
  initialRegistration?: ViewerRegistration | null;
  onSuccess: (result: RegistrationResult) => void;
  availabilityBlocked?: boolean;
  onAvailabilityCheck?: () => Promise<MarketplaceProgressResponse | null>;
}

export default function JoinBatchForm({
  item,
  consentGiven,
  viewerLocation = null,
  initialRegistration = null,
  onSuccess,
  availabilityBlocked = false,
  onAvailabilityCheck,
}: JoinBatchFormProps) {
  const router=useRouter();
  const [terms,setTerms]=useState(false);
  const earlyMinimum = item.earlyPayment?.proposal?.status === "pending" ? item.earlyPayment.proposal.minimumQuantity : item.earlyPayment?.originalMinimumQuantity ?? null;
  const [quantity, setQuantity] = useState<number | "">(initialRegistration?.quantity ?? 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [conflict, setConflict] = useState<ViewerRegistration | null>(initialRegistration);
  const [failedAvailability, setFailedAvailability] = useState<MarketplaceItem["availability"] | null>(null);
  const verificationFailed = failedAvailability !== null && failedAvailability === item.availability;
  const remaining = item.availability?.remainingQuantity;
  const tooMany = remaining != null && typeof quantity === "number" && quantity > remaining;
  const termsRequired = item.policyVersion === 2 || item.earlyPayment?.proposal?.status === "pending" || earlyMinimum != null;
  const submitDisabled = availabilityBlocked || verificationFailed || item.availability?.canRegister === false || tooMany || !consentGiven || submitting || (termsRequired && !terms) || (conflict != null && !conflict.canWithdraw);

  async function checkAvailability() {
    if (!onAvailabilityCheck) return null;
    const snapshot = await onAvailabilityCheck();
    setFailedAvailability(snapshot ? null : item.availability);
    return snapshot;
  }

  useEffect(()=>{ const timer=setTimeout(()=>{try{const stored=Number(sessionStorage.getItem(`wesup:join:${item.id}`));if(Number.isSafeInteger(stored)&&stored>0)setQuantity(stored);}catch{}},0);return()=>clearTimeout(timer);},[item.id]);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitDisabled) return;

    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0) {
      setError("Masukkan jumlah porsi yang valid.");
      return;
    }

    if (conflict) {
      await withdrawAndRejoin(conflict);
      return;
    }

    await submitRegistration();
  }

  async function submitRegistration() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchId: item.id,
          quantity,
          consentAccepted: termsRequired ? terms : undefined,
          consentSnapshot: termsRequired ? {earlyPaymentMinimumQuantity:item.earlyPayment?.originalMinimumQuantity ?? null,earlyPaymentProposalId:item.earlyPayment?.proposal?.status === "pending" ? item.earlyPayment.proposal.id : null,earlyPaymentProposalRevision:item.earlyPayment?.proposal?.status === "pending" ? item.earlyPayment.proposal.revision : null,paymentOpeningPolicy:item.paymentOpeningPolicy??"fixed_cutoff",maximumUnitPrice:item.basePrice,unit:item.unit,pickupAddress:item.pickupAddress,paymentOpensAt:item.paymentOpensAt,paymentClosesAt:item.paymentClosesAt,pickupStartsAt:item.pickupStartsAt,pickupEndsAt:item.pickupEndsAt}:undefined,
          consentLat: viewerLocation?.latitude ?? null,
          consentLng: viewerLocation?.longitude ?? null,
        }),
      });

      if(response.status===401){router.push(`/login?role=umkm&returnTo=${encodeURIComponent(`/marketplace/${item.id}`)}`);return;}
      if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as {
          error?: unknown;
          code?: unknown;
          details?: { registrationId?: unknown; quantity?: unknown; canWithdraw?: unknown };
        } | null;
        const duplicate = toDuplicateRegistration(body);
        if (duplicate) {
          setConflict(duplicate);
          return;
        }
        const snapshot = await checkAvailability();
        const available = snapshot?.availability?.remainingQuantity;
        throw new Error(available != null && available > 0 ? `Sisa kuota ${available} ${item.unit ?? "porsi"}. Sesuaikan jumlah pesanan Anda.` : feedbackError(body?.error, "Penawaran berubah. Periksa ketersediaan terbaru."));
      }
      if (response.status === 403) await checkAvailability();
      if (!response.ok) throw new Error(await readApiError(response));
      const result = (await response.json()) as Partial<RegistrationResult>;
      if (
        typeof result.count !== "number" ||
        typeof result.registrationId !== "string" ||
        result.registrationId.length === 0
      ) {
        throw new Error("Respons pendaftaran tidak valid.");
      }

      setSucceeded(true);
      if(item.policyVersion===2) {sessionStorage.removeItem(`wesup:join:${item.id}`);router.push(`/umkm/pesanan/${result.registrationId}`);}
      onSuccess({ count: result.count, registrationId: result.registrationId });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Pendaftaran gagal. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  /** A repeated join must not be reported as a fresh registration: the API
   * answers 409 with the registration that is already in force. */
  function toDuplicateRegistration(body: {
    code?: unknown;
    details?: { registrationId?: unknown; quantity?: unknown; canWithdraw?: unknown };
  } | null): ViewerRegistration | null {
    if (body?.code !== "REGISTRATION_ALREADY_EXISTS") return null;
    const registrationId = body.details?.registrationId;
    if (typeof registrationId !== "string" || registrationId.length === 0) return null;
    return {
      registrationId,
      quantity: typeof body.details?.quantity === "number" ? body.details.quantity : null,
      canWithdraw: body.details?.canWithdraw === true,
    };
  }

  /** Quantity changes stay cancel-then-rejoin: withdraw the active
   * registration, then register again with the new quantity. */
  async function withdrawAndRejoin(active: ViewerRegistration) {
    if (!active.canWithdraw) {
      setError("Pendaftaran ini sudah terkunci. Buka pesanan untuk membayar atau hubungi bantuan.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/umkm/orders/${active.registrationId}/withdraw`, {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setConflict(null);
      await submitRegistration();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Pendaftaran gagal. Coba lagi.");
      setSubmitting(false);
    }
  }

  if (succeeded) {
    return (
      <div className="flex flex-col gap-3 border border-wesup-ink/15 bg-wesup-paper p-4 tabular-nums" role="status">
        <p className="font-semibold text-wesup-ink">Pendaftaran berhasil.</p>
        <p className="text-sm text-wesup-ink-sub">
          Pantau detail pesanan untuk jadwal pembayaran dan pengambilan.
        </p>
        <Link
          href="/umkm/pesanan"
          className="inline-flex w-fit items-center bg-wesup-ink px-3 py-2 text-sm font-bold text-wesup-paper hover:bg-wesup-red"
        >
          Lihat Pesanan
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 tabular-nums" noValidate>
      <div className="flex flex-col gap-1.5 tabular-nums">
        <label htmlFor="join-batch-quantity" className="text-wesup-ink-sub font-mono text-[0.6875rem] uppercase tracking-[0.18em]">
          {item.policyVersion===2?`Jumlah (${item.unit ?? "pcs"})`:"Jumlah porsi"}
        </label>
        <input
          id="join-batch-quantity"
          name="quantity"
          type="number"
          min={1}
          max={remaining ?? undefined}
          step={1}
          value={quantity}
          onChange={(event) => {
            const raw = event.target.value;
            setQuantity(raw === "" ? "" : Number(raw));
            try {sessionStorage.setItem(`wesup:join:${item.id}`,raw);} catch {}
            setTerms(false);
          }}
          disabled={submitting}
          className="w-full border border-wesup-ink/15 bg-wesup-paper px-3 py-2 text-sm text-wesup-ink focus:border-wesup-ink/20 focus:outline-none"
        />
      </div>

      {remaining != null && <p className="text-xs leading-6 text-wesup-ink-sub" role="status">Sisa kuota: {remaining.toLocaleString("id-ID")} {item.unit ?? "porsi"}.{tooMany ? " Sesuaikan jumlah pesanan Anda." : ""}</p>}
      {(verificationFailed || availabilityBlocked) && onAvailabilityCheck && <button type="button" disabled={submitting} onClick={() => void checkAvailability()} className="min-h-11 text-left text-sm font-semibold underline underline-offset-4">Periksa ketersediaan lagi</button>}

      {termsRequired && <section className="space-y-3 border bg-wesup-paper p-4 text-sm"><p>Jumlah: {quantity || 0} {item.unit}. Total maksimum: <strong>{new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(quantity)*item.basePrice)}</strong></p><p>Estimasi saat ini: {new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(quantity)*item.currentTierPrice)}. Harga belum final.</p>{item.paymentOpeningPolicy==="capacity_or_cutoff"?<p>Pembayaran dibuka segera ketika kapasitas penuh, atau paling lambat {formatTransactionDate(item.paymentOpensAt)}. Batas bayar 24 jam sejak pengumpulan ditutup. Jadwal pengambilan tetap.</p>:<p>Bayar {formatTransactionDate(item.paymentOpensAt)} sampai {formatTransactionDate(item.paymentClosesAt)}.</p>}{earlyMinimum != null && <p>Supplier dapat menutup pendaftaran setelah terkumpul minimal {earlyMinimum} {item.unit}. Pembayaran berlangsung 24 jam sejak pendaftaran ditutup. Jadwal pengambilan tetap.</p>}{item.earlyPayment?.proposal?.status === "pending" && <p>Dengan bergabung, Anda menyetujui usulan pembukaan lebih awal revisi {item.earlyPayment.proposal.revision}. Seluruh peserta aktif harus setuju; supplier tetap mengonfirmasi pembukaan.</p>}<p>Ambil di {item.pickupAddress}, {formatTransactionDate(item.pickupStartsAt)} sampai {formatTransactionDate(item.pickupEndsAt)}.</p><label className="flex items-start gap-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] tabular-nums"><input className="mt-1 size-5 shrink-0 font-sans normal-case tracking-normal" type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/>Saya memahami harga dapat berubah sampai batas ikut; saya boleh batal tanpa penalti selama pengumpulan masih dibuka. {item.paymentOpeningPolicy === "capacity_or_cutoff" ? "Pengumpulan dapat ditutup lebih awal ketika kapasitas penuh. " : ""}Sesudahnya harga final terkunci dan saya wajib membayar. Tidak membayar dapat memicu peringatan, suspend 7 hari, lalu permanen. Tidak mengambil pada jadwal yang disetujui saat supplier siap membuat dana diberikan kepada supplier.</label>{!terms && <p className="text-xs font-medium text-wesup-ink-sub">Centang persetujuan syarat di atas untuk mengaktifkan tombol konfirmasi.</p>}</section>}
      {conflict ? (
        <div className="flex flex-col gap-3 border border-wesup-ink bg-wesup-paper p-4 text-sm" role="alert">
          <p className="font-semibold text-wesup-ink">Anda sudah terdaftar pada batch ini.</p>
          <p className="text-wesup-ink-sub">
            Pendaftaran aktif tercatat dengan jumlah {conflict.quantity ?? "—"} {item.unit ?? "pcs"}.
            {conflict.canWithdraw
              ? " Batalkan pendaftaran ini lebih dulu untuk memakai jumlah baru."
              : " Pendaftaran sudah terkunci dan tidak dapat dibatalkan."}
          </p>
          <Link
            href={`/umkm/pesanan/${conflict.registrationId}`}
            className="inline-flex w-fit items-center bg-wesup-ink px-3 py-2 text-sm font-bold text-wesup-paper hover:bg-wesup-red"
          >
            Buka pesanan saya
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="border border-wesup-red bg-wesup-paper px-3 py-2 text-sm font-medium text-wesup-ink" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitDisabled}
        className={`inline-flex w-full items-center justify-center px-4 py-3 text-sm font-bold transition-colors ${
          !submitDisabled
            ? "bg-wesup-ink text-wesup-paper hover:bg-wesup-red"
            : "cursor-not-allowed bg-wesup-paper-sub text-wesup-ink/40"
        }`}
      >
        {submitting
          ? "Mendaftarkan…"
          : conflict
            ? conflict.canWithdraw
              ? "Batalkan & daftar ulang"
              : "Sudah terdaftar"
            : item.policyVersion===2 ? "Konfirmasi ikut pesanan" : "Daftar Sekarang"}
      </button>

      {!consentGiven ? (
        <p className="text-xs font-medium text-wesup-ink-sub">
          Centang persetujuan lokasi pengambilan untuk mengaktifkan tombol daftar.
        </p>
      ) : null}
    </form>
  );
}
