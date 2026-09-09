import { FileText, MapPin, Tag, Layers } from "lucide-react";
import type { PaymentInvoice } from "@/lib/payments/types";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

export default function PaymentInvoiceCard({
  invoice,
}: {
  invoice: PaymentInvoice;
}) {
  const savings =
    (invoice.basePricePerUnit - invoice.tierPricePerUnit) * invoice.quantity;

  return (
    <section
      aria-label="Tagihan pembayaran"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText aria-hidden="true" className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Tagihan Final
            </h2>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {invoice.batchDisplayCode}
          </span>
        </div>
      </header>

      <div className="divide-y divide-slate-100 px-5">
        <div className="py-4">
          <p className="font-bold text-slate-900">{invoice.batchTitle}</p>
          <p className="text-sm text-slate-500">{invoice.supplierName}</p>
        </div>

        <dl className="py-4 text-sm">
          <div className="flex items-center justify-between py-1">
            <dt className="text-slate-500">Kuantitas</dt>
            <dd className="font-semibold text-slate-900">
              {invoice.quantity} {invoice.unit}
            </dd>
          </div>
          <div className="flex items-center justify-between py-1">
            <dt className="flex items-center gap-1.5 text-slate-500">
              <Layers aria-hidden="true" className="h-3.5 w-3.5" />
              Harga / {invoice.unit} (Tier {invoice.lockedTier})
            </dt>
            <dd className="font-semibold text-slate-900">
              {money.format(invoice.tierPricePerUnit)}
            </dd>
          </div>
          <div className="flex items-center justify-between py-1">
            <dt className="text-slate-500 line-through">Harga dasar (Tier 1)</dt>
            <dd className="font-semibold text-slate-400 line-through">
              {money.format(invoice.basePricePerUnit)}
            </dd>
          </div>
          {savings > 0 && (
            <div className="flex items-center justify-between py-1">
              <dt className="flex items-center gap-1.5 text-emerald-600">
                <Tag aria-hidden="true" className="h-3.5 w-3.5" />
                Diskon terkunci
              </dt>
              <dd className="font-semibold text-emerald-600">
                −{money.format(savings)}
              </dd>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
            <dt className="text-sm font-bold text-slate-900">Total Tagihan</dt>
            <dd className="text-xl font-black text-slate-900">
              {money.format(invoice.grossAmount)}
            </dd>
          </div>
        </dl>

        <div className="py-4 text-xs text-slate-500">
          <p className="flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
            Titik kumpul: {invoice.pickupAddress}
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-slate-400">
            Referensi: {invoice.midtransOrderId} · Estimasi siap:{" "}
            {formatDate(invoice.estimatedReadyAt)}
          </p>
        </div>
      </div>
    </section>
  );
}