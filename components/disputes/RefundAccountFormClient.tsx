"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import type { AccountOrder } from "@/lib/orders/types";
import type { RefundStatus, RefundTicket } from "@/lib/dispute/types";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function maskAccountNumber(number: string): string {
  const visible = number.slice(-4);
  return `•••• ${visible}`;
}

export default function RefundAccountFormClient({
  order,
  refund,
}: {
  order: AccountOrder;
  refund: RefundTicket | null;
}) {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!refund) {
    return (
      <BlockedPanel title="Rekening refund belum tersedia">
        <p>
          Formulir Pengisian Rekening Manual hanya ditampilkan setelah Admin memenangkan sengketa
          pihak UMKM dan menyetujui pengembalian dana penuh (Full Refund).
        </p>
      </BlockedPanel>
    );
  }

  if (refund.status !== "waiting_bank_account") {
    return (
      <BlockedPanel title={REFUND_BLOCKED_TITLE[refund.status]}>
        {refund.bankAccount ? (
          <p>
            Rekening tujuan Anda sudah tersimpan: {refund.bankAccount.bankName} ·{" "}
            {maskAccountNumber(refund.bankAccount.accountNumber)} ·{" "}
            {refund.bankAccount.accountHolderName}.
          </p>
        ) : (
          <p>
            Pengisian rekening akan dibuka setelah Admin menyetujui refund untuk sengketa ini.
          </p>
        )}
      </BlockedPanel>
    );
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <OrderHeader order={order} refund={refund} />
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-600" />
            </span>
            <div>
              <h2 className="font-bold text-emerald-900">Rekening berhasil disimpan</h2>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                Data rekening Anda telah tercatat. Admin akan mentransfer {money.format(refund.amount)}{" "}
                secara manual dan memperbarui tiket refund menjadi{" "}
                <strong>&quot;Refund Selesai&quot;</strong> setelah transfer tervalidasi.
              </p>
              <Link
                href={`/pesanan/${order.id}/sengketa`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Kembali ke Lacak Sengketa
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const trimmedBank = bankName.trim();
    const trimmedNumber = accountNumber.trim();
    const trimmedHolder = accountHolderName.trim();
    const trimmedConfirm = confirmAccountNumber.trim();

    if (!trimmedBank || !trimmedNumber || !trimmedHolder || !trimmedConfirm) {
      setFormError("Lengkapi seluruh kolom rekening sebelum menyimpan.");
      return;
    }
    if (!/^\d+$/.test(trimmedNumber)) {
      setFormError("Nomor rekening hanya boleh berisi angka.");
      return;
    }
    if (trimmedNumber.length < 6 || trimmedNumber.length > 25) {
      setFormError("Panjang nomor rekening tidak valid (6–25 digit).");
      return;
    }
    if (trimmedNumber !== trimmedConfirm) {
      setFormError("Nomor rekening dan konfirmasi tidak sama.");
      return;
    }

    setSubmitted(true);
  };

  return (
    <div className="space-y-6">
      <OrderHeader order={order} refund={refund} />

      <section className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">Full Refund disetujui</p>
        <p className="mt-0.5">
          Sengketa dimenangkan UMKM. Lengkapi rekening manual agar{" "}
          <strong>{money.format(refund.amount)}</strong> dapat dikembalikan tanpa potongan.
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
            <Landmark aria-hidden="true" className="h-4 w-4 text-blue-600" />
          </span>
          <p className="text-xs leading-relaxed text-slate-500">
            Refund QRIS tidak dapat dibalik otomatis oleh gateway — penyaluran dilakukan manual
            oleh Admin. Pastikan data rekening benar karena menjadi dasar transfer kembali.
          </p>
        </div>

        <div>
          <label
            htmlFor="refund-bank-name"
            className="text-sm font-bold uppercase tracking-wide text-slate-700"
          >
            Nama bank
          </label>
          <input
            id="refund-bank-name"
            type="text"
            value={bankName}
            onChange={(event) => setBankName(event.target.value)}
            autoComplete="off"
            placeholder="Contoh: BRI, BCA, Mandiri"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="refund-account-number"
              className="text-sm font-bold uppercase tracking-wide text-slate-700"
            >
              Nomor rekening
            </label>
            <input
              id="refund-account-number"
              type="text"
              inputMode="numeric"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              autoComplete="off"
              placeholder="Hanya angka"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label
              htmlFor="refund-confirm-account-number"
              className="text-sm font-bold uppercase tracking-wide text-slate-700"
            >
              Konfirmasi nomor rekening
            </label>
            <input
              id="refund-confirm-account-number"
              type="text"
              inputMode="numeric"
              value={confirmAccountNumber}
              onChange={(event) => setConfirmAccountNumber(event.target.value)}
              autoComplete="off"
              placeholder="Ulangi nomor rekening"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="refund-account-holder"
            className="text-sm font-bold uppercase tracking-wide text-slate-700"
          >
            Nama pemilik rekening
          </label>
          <input
            id="refund-account-holder"
            type="text"
            value={accountHolderName}
            onChange={(event) => setAccountHolderName(event.target.value)}
            autoComplete="off"
            placeholder="Nama sesuai buku rekening"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {formError && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {formError}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/pesanan/${order.id}/sengketa`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Kembali ke Sengketa
          </Link>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Landmark aria-hidden="true" size={16} />
            Simpan Rekening Refund
          </button>
        </div>
      </form>
    </div>
  );
}

const REFUND_BLOCKED_TITLE: Record<RefundStatus, string> = {
  pending: "Menunggu Persetujuan Refund",
  waiting_bank_account: "Menunggu Rekening",
  processing: "Refund Sedang Diproses",
  completed: "Refund Selesai",
  failed: "Refund Gagal",
};

function OrderHeader({ order, refund }: { order: AccountOrder; refund: RefundTicket }) {
  return (
    <div>
      <Link
        href={`/pesanan/${order.id}/sengketa`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Lacak Sengketa
      </Link>
      <header className="mt-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          Pengisian Rekening Manual
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          {order.batchTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {order.counterparty} ·{" "}
          <span className="font-mono">{order.batchDisplayCode}</span> · Refund{" "}
          {money.format(refund.amount)}
        </p>
      </header>
    </div>
  );
}

function BlockedPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          Pengisian Rekening Manual
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      </header>
      <section className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
          <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-600" />
        </span>
        <div className="text-sm leading-relaxed text-slate-600">{children}</div>
      </section>
      <Link
        href="/pesanan"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Kembali ke Pesanan
      </Link>
    </div>
  );
}