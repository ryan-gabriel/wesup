"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCheck,
  Clock,
  Copy,
  CreditCard,
  KeyRound,
  MapPin,
  PackageCheck,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Store,
  XCircle,
} from "lucide-react";
import type {
  AccountOrderStatus,
  PickupCredential,
} from "@/lib/orders/types";
import { getComplaintScenario } from "@/lib/dispute/mock-data";
import PickupQrBlock from "./PickupQrBlock";
import EscrowCountdown from "@/components/disputes/EscrowCountdown";

const ESCROW_WINDOW_MS = 24 * 60 * 60 * 1000;

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

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dates.format(date);
}

const WAIT_BANNER: Record<
  AccountOrderStatus,
  { label: string; description: string } | null
> = {
  registered: {
    label: "Menunggu Jendela Pembayaran Dibuka",
    description:
      "Registrasi Anda tercatat. Kode QR dan PIN pengambilan baru diterbitkan setelah tagihan dibayar lunas saat jendela pembayaran aktif.",
  },
  pending_payment: {
    label: "Kredensial Belum Terbit",
    description:
      "Tagihan belum dibayar. Selesaikan pembayaran QRIS untuk menerbitkan kode QR pengambilan dan PIN 4 digit.",
  },
  paid: null,
  picked_up: {
    label: "Serah Terima Selesai",
    description:
      "Barang sudah Anda ambil dan tervalidasi Supplier. Hitung mundur escrow 1×24 jam telah berjalan sejak pengambilan.",
  },
  no_show: {
    label: "Tidak Hadir — Dana Hangus",
    description:
      "Anda tidak mengambil barang hingga batas toleransi 12 jam sejak estimasi siap. Sesuai ketentuan PRD 2.2.4, dana tidak dapat dikembalikan (non-refundable).",
  },
  cancelled: {
    label: "Pesanan Dibatalkan",
    description:
      "Pesanan ini dibatalkan. Jika sudah pernah membayar, refund akan diproses oleh Admin.",
  },
};

export default function PickupCredentialClient({
  credential,
}: {
  credential: PickupCredential;
}) {
  const banner = WAIT_BANNER[credential.status];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <Link
          href="/pesanan"
          className="inline-flex items-center gap-1 font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Pesanan
        </Link>
        <span aria-hidden="true" className="text-slate-300">
          /
        </span>
        <span className="truncate font-medium text-slate-500">
          Serah Terima
        </span>
      </nav>

      <header>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
          <QrCode aria-hidden="true" className="h-4 w-4" />
          Serah Terima Pengambilan
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          {credential.batchTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {credential.supplierName} ·{" "}
          <span className="font-mono">{credential.batchDisplayCode}</span>
        </p>
      </header>

      {banner ? (
        <section
          aria-label={`Status pesanan: ${banner.label}`}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100"
            >
              <StatusIcon status={credential.status} />
            </span>
            <div>
              <h2 className="font-bold text-slate-900">{banner.label}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {banner.description}
              </p>
              {credential.status === "pending_payment" && (
                <Link
                  href={`/pesanan/${credential.orderId}/bayar`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <CreditCard aria-hidden="true" size={16} />
                  Bayar Sekarang
                </Link>
              )}
              {credential.status === "picked_up" && (
                <PickupCompletedSection credential={credential} />
              )}
            </div>
          </div>
        </section>
      ) : (
        <PaidCredential credential={credential} />
      )}

      <OrderSummaryCard credential={credential} />

      <PickupRulesNote />
    </div>
  );
}

function StatusIcon({ status }: { status: AccountOrderStatus }) {
  const className = "h-5 w-5";
  switch (status) {
    case "registered":
      return <Clock aria-hidden="true" className={`${className} text-slate-500`} />;
    case "pending_payment":
      return (
        <CreditCard aria-hidden="true" className={`${className} text-amber-600`} />
      );
    case "picked_up":
      return (
        <PackageCheck
          aria-hidden="true"
          className={`${className} text-emerald-600`}
        />
      );
    case "no_show":
      return <XCircle aria-hidden="true" className={`${className} text-red-600`} />;
    case "cancelled":
      return <Ban aria-hidden="true" className={`${className} text-slate-500`} />;
    default:
      return null;
  }
}

function PickupCompletedSection({ credential }: { credential: PickupCredential }) {
  const deadlineAt = credential.pickedUpAt
    ? new Date(new Date(credential.pickedUpAt).getTime() + ESCROW_WINDOW_MS).toISOString()
    : null;
  const scenario = getComplaintScenario(credential.orderId);

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
      {deadlineAt && <EscrowCountdown deadlineAt={deadlineAt} />}
      <p className="text-xs leading-relaxed text-slate-500">
        Hitung mundur escrow 1×24 jam berjalan sejak pengambilan. Ajukan komplain sebelum batas
        waktu ini untuk membekukan pencairan dana ke Supplier.
      </p>
      {scenario?.kind === "filed" ? (
        <Link
          href={`/pesanan/${credential.orderId}/sengketa`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
        >
          <ShieldCheck aria-hidden="true" size={16} />
          Lacak Sengketa
        </Link>
      ) : scenario?.kind === "window_open" ? (
        <Link
          href={`/pesanan/${credential.orderId}/komplain`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        >
          <ShieldAlert aria-hidden="true" size={16} />
          Ajukan Komplain
        </Link>
      ) : null}
    </div>
  );
}

function PaidCredential({ credential }: { credential: PickupCredential }) {
  if (credential.status !== "paid") return null;
  const seed = `${credential.pickupCode ?? credential.orderId}::${credential.orderId}`;

  return (
    <section
      aria-label="Kode QR dan PIN pengambilan"
      className="grid grid-cols-1 gap-5 lg:grid-cols-2"
    >
      {/* QR */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
          <QrCode aria-hidden="true" size={18} className="text-blue-600" />
          Kode QR Pengambilan
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Perlihatkan kode ini ke Supplier saat tiba di titik kumpul.
        </p>
        {credential.pickupCode ? (
          <PickupQrBlock seed={seed} />
        ) : (
          <p className="text-sm text-slate-500">Kode QR belum tersedia.</p>
        )}
      </div>

      {/* PIN */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
          <KeyRound aria-hidden="true" size={18} className="text-blue-600" />
          PIN 4-digit Cadangan
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Gunakan PIN ini jika kamera Supplier bermasalah (fallback operasional).
        </p>
        {credential.pinCode ? (
          <PinDisplay pin={credential.pinCode} orderId={credential.orderId} />
        ) : (
          <p className="text-sm text-slate-500">PIN belum tersedia.</p>
        )}
      </div>

      {/* Pickup window & address */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
          <CalendarClock aria-hidden="true" size={18} className="text-blue-600" />
          Lokasi & Jendela Pengambilan
        </h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <MapPin
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
            />
            <div>
              <dt className="font-semibold text-slate-900">Titik kumpul</dt>
              <dd className="text-slate-600">{credential.pickupAddress}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
            />
            <div>
              <dt className="font-semibold text-slate-900">
                Estimasi siap (awal jendela)
              </dt>
              <dd className="text-slate-600">
                {formatDate(credential.estimatedReadyAt)}
              </dd>
            </div>
          </div>
        </dl>
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Waktu pengambilan tersedia hingga{" "}
          <strong>{formatDate(credential.pickupDeadlineAt)}</strong> — jendela
          toleransi 12 jam sejak estimasi siap. Melewati batas tersebut
          mengaktifkan skenario No-Show (dana hangus 100%, non-refundable).
        </p>
      </div>
    </section>
  );
}

function PinDisplay({ pin, orderId }: { pin: string; orderId: string }) {
  const [copied, setCopied] = useState(false);

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
    } catch {
      setCopied(true);
    }
  };

  return (
    <div>
      <div
        aria-hidden="true"
        className="grid grid-cols-4 gap-2"
      >
        {pin.split("").map((digit, index) => (
          <div
            key={`${orderId}-pin-${index}`}
            className="rounded-xl border border-slate-300 bg-slate-50 py-4 text-center font-mono text-3xl font-black text-slate-900"
          >
            {digit}
          </div>
        ))}
      </div>
      <p className="sr-only">PIN 4 digit: {pin.split("").join(" ")}</p>
      <button
        type="button"
        onClick={copyPin}
        aria-label={copied ? "PIN tersalin ke clipboard" : "Salin PIN"}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        {copied ? (
          <>
            <CheckCheck aria-hidden="true" className="h-4 w-4 text-emerald-600" />
            PIN tersalin
          </>
        ) : (
          <>
            <Copy aria-hidden="true" className="h-4 w-4" />
            Salin PIN
          </>
        )}
      </button>
    </div>
  );
}

function OrderSummaryCard({ credential }: { credential: PickupCredential }) {
  return (
    <section
      aria-label="Ringkasan pesanan"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-slate-100 bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-2">
          <ShoppingBag aria-hidden="true" className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Ringkasan Pesanan
          </h2>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="flex items-center gap-1.5 text-xs text-slate-500">
            <Store aria-hidden="true" className="h-3.5 w-3.5" />
            Supplier
          </dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {credential.supplierName}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Kuantitas</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {credential.quantity} {credential.unit}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Tier terkunci</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            Tier {credential.lockedTier ?? 1}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Total tagihan</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {money.format(credential.finalAmount)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function PickupRulesNote() {
  return (
    <section
      aria-label="Aturan serah terima"
      className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"
    >
      <p className="font-semibold">Aturan serah terima (PRD 2.2.4)</p>
      <ul className="mt-1 list-inside list-disc space-y-1 text-blue-800">
        <li>
          Kode QR &amp; PIN hanya diterbitkan setelah tagihan <strong>lunas</strong>.
        </li>
        <li>
          Berhasil dipindai menandai pesanan <strong>Sudah Diambil</strong> dan
          memulai hitung mundur escrow 1×24 jam.
        </li>
        <li>
          Tidak hadir hingga batas toleransi 12 jam sejak estimasi siap memicu
          skenario No-Show: dana hangus 100% dan tidak dapat di-refund.
        </li>
      </ul>
    </section>
  );
}