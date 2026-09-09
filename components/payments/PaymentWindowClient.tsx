"use client";

import Link from "next/link";
import { ArrowLeft, Clock, CreditCard, CheckCircle2, CalendarClock, QrCode } from "lucide-react";
import type { PaymentInvoice } from "@/lib/payments/types";
import { evaluatePaymentWindow } from "@/lib/orders/time-gatekeeper";
import PaymentCountdown from "./PaymentCountdown";
import PaymentInvoiceCard from "./PaymentInvoiceCard";
import QrisPaymentMock from "./QrisPaymentMock";
import HitAndRunBanner from "./HitAndRunBanner";

const dateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

export default function PaymentWindowClient({
  invoice,
}: {
  invoice: PaymentInvoice;
}) {
  // State Gate dihitung dari serverTimestamp mock — bukan jam perangkat.
  const gate = evaluatePaymentWindow(
    {
      registration_opens_at: invoice.paymentOpensAt,
      registration_closes_at: invoice.paymentOpensAt,
      payment_opens_at: invoice.paymentOpensAt,
      payment_closes_at: invoice.paymentClosesAt,
      estimated_ready_at: invoice.estimatedReadyAt,
    },
    invoice.serverTimestamp,
  );

  const isPaid = invoice.resolution === "paid";
  const isExpired = !isPaid && gate.state === "expired";
  const isOpen = !isPaid && gate.state === "open";
  const isWaiting = !isPaid && gate.state === "waiting";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
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
          Bayar {invoice.batchTitle}
        </span>
      </nav>

      <header>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
          <CreditCard aria-hidden="true" className="h-4 w-4" />
          Pembayaran Tagihan
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          {invoice.batchTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tagihan final terkunci pada tier diskon{" "}
          <strong className="font-semibold text-slate-700">
            Tier {invoice.lockedTier}
          </strong>{" "}
          saat pendaftaran ditutup.
        </p>
      </header>

      {isExpired && invoice.strikes ? (
        <HitAndRunBanner strikes={invoice.strikes} />
      ) : null}

      {isPaid ? (
        <section
          aria-label="Pembayaran lunas"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
          />
          <div>
            <h2 className="text-sm font-bold text-emerald-800">
              Pembayaran terkonfirmasi lunas
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-emerald-700">
              Webhook Midtrans telah diterima. Kode QR pengambilan dan PIN
              4 digit sudah diterbitkan di halaman serah terima.
            </p>
            <Link
              href={`/pesanan/${invoice.orderId}/serah-terima`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <QrCode aria-hidden="true" className="h-4 w-4" />
              Lihat Kode QR Pengambilan
            </Link>
          </div>
        </section>
      ) : (
        <section
          aria-label="Status jendela pembayaran"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Clock aria-hidden="true" className="h-4 w-4 text-slate-400" />
              {isWaiting && "Menunggu jendela pembayaran dibuka"}
              {isOpen && "Sisa waktu pembayaran"}
              {isExpired && "Jendela pembayaran ditutup"}
            </div>
            {isWaiting && (
              <PaymentCountdown
                serverNowIso={invoice.serverTimestamp}
                deadlineIso={invoice.paymentOpensAt}
                tone="info"
              />
            )}
            {isOpen && (
              <PaymentCountdown
                serverNowIso={invoice.serverTimestamp}
                deadlineIso={invoice.paymentClosesAt}
                tone="danger"
              />
            )}
            {isExpired && (
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                Expired
              </span>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <CalendarClock
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
              />
              <span>
                Buka:{" "}
                <strong className="font-semibold text-slate-700">
                  {formatDate(invoice.paymentOpensAt)}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
              />
              <span>
                Batas akhir:{" "}
                <strong className="font-semibold text-slate-700">
                  {formatDate(invoice.paymentClosesAt)}
                </strong>
              </span>
            </div>
          </dl>
        </section>
      )}

      <PaymentInvoiceCard invoice={invoice} />
      <QrisPaymentMock
        resolution={invoice.resolution}
        grossAmount={invoice.grossAmount}
      />

      <p className="text-center text-[11px] leading-relaxed text-slate-400">
        Hitung mundur dikalkulasi dari <strong>Server Timestamp</strong> respons
        API Gatekeeper, bukan jam lokal perangkat — mencegah manipulasi batas
        waktu. Melewatkan window memicu sanksi Hit & Run berjenjang.
      </p>
    </div>
  );
}