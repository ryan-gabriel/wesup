import { QrCode, ShieldCheck } from "lucide-react";
import type { PaymentResolution } from "@/lib/payments/types";

interface QrisPaymentMockProps {
  resolution: PaymentResolution;
  grossAmount: number;
}

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/**
 * Placeholder statis untuk QRIS Midtrans Sandbox. Blok ini hanya menandakan
 * area QRIS — role pemoles berikutnya menggantinya dengan `qr_code_url`
 * asli dari tabel `payments` + refresh status via webhook listener.
 */
export default function QrisPaymentMock({
  resolution,
  grossAmount,
}: QrisPaymentMockProps) {
  const locked =
    resolution === "waiting" || resolution === "expired" || resolution === "paid";

  return (
    <section
      aria-label="Pembayaran QRIS"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div className="flex items-center gap-2">
          <QrCode aria-hidden="true" className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Bayar via QRIS
          </h2>
          <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Midtrans Sandbox
          </span>
        </div>
      </header>

      <div className="flex flex-col items-center gap-4 px-5 py-6">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50"
          aria-hidden="true"
        >
          <div className="text-center">
            <QrCode className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              QRIS Placeholder
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-slate-500">Nominal tagihan</p>
          <p className="text-2xl font-black text-slate-900">
            {money.format(grossAmount)}
          </p>
        </div>

        <button
          type="button"
          disabled={locked}
          aria-disabled={locked}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
            locked
              ? "cursor-not-allowed bg-slate-200 text-slate-500"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          {resolution === "waiting" && "Tunggu jendela pembayaran dibuka"}
          {resolution === "expired" && "Jendela pembayaran sudah ditutup"}
          {resolution === "paid" && "Pembayaran lunas"}
          {resolution === "open" && "Bayar via QRIS"}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-slate-400">
          Pembayaran harus diselesaikan di dalam Payment Window. Di luar jendela,
          API Gatekeeper menolak transaksi dan tombol akan terkunci.
        </p>
      </div>
    </section>
  );
}