"use client";

import {
  AlertCircle,
  Calendar,
  CreditCard,
  MapPin,
  Package,
  TrendingDown,
  Truck,
} from "lucide-react";
import type { RecurringBatchPreview } from "@/lib/supplier-recurring/types";

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

interface RecurringBatchPreviewProps {
  preview: RecurringBatchPreview;
}

export default function RecurringBatchPreviewCard({
  preview,
}: RecurringBatchPreviewProps) {
  const lowestPrice = preview.tiers.at(-1)?.pricePerUnit ?? 0;
  const highestPrice = preview.tiers.at(0)?.pricePerUnit ?? 0;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-blue-900">
        <Package size={16} className="text-blue-600" />
        Preview Batch yang Akan Di-generate
      </h3>

      {/* Product Info */}
      <section className="mb-3 rounded-lg border border-white bg-white p-4 shadow-sm">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-900">
          <Package size={14} className="text-blue-500" />
          Detail Produk
        </h4>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Nama Produk</dt>
            <dd className="font-semibold text-slate-900">{preview.templateTitle}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Kategori</dt>
            <dd>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                {preview.category}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Tier Pricing */}
      <section className="mb-3 rounded-lg border border-white bg-white p-4 shadow-sm">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-900">
          <TrendingDown size={14} className="text-blue-500" />
          Skema Harga Tier
        </h4>
        <div className="mb-2 flex items-baseline gap-3">
          <span className="text-lg font-bold text-blue-700">
            {money.format(lowestPrice)}
          </span>
          {lowestPrice < highestPrice && (
            <span className="text-xs text-slate-400 line-through">
              {money.format(highestPrice)}
            </span>
          )}
        </div>
        <ul className="space-y-1 text-sm">
          {preview.tiers.map((tier) => (
            <li key={tier.tierNumber} className="flex justify-between">
              <span className="text-slate-600">
                Tier {tier.tierNumber}: {tier.minimumQuantity}–
                {tier.maximumQuantity ?? "+"} pcs
              </span>
              <strong className="text-slate-900">
                {money.format(tier.pricePerUnit)}
              </strong>
            </li>
          ))}
        </ul>
      </section>

      {/* Timeline */}
      <section className="mb-3 rounded-lg border border-white bg-white p-4 shadow-sm">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-900">
          <Calendar size={14} className="text-indigo-500" />
          Timeline (Estimasi)
        </h4>
        <dl className="space-y-1.5 text-sm">
          {(
            [
              ["Buka Pendaftaran", preview.estimatedRegistrationOpensAt, Calendar, "text-indigo-600"],
              ["Tutup Pendaftaran", preview.estimatedRegistrationClosesAt, Calendar, "text-indigo-600"],
              ["Mulai Payment", preview.estimatedPaymentOpensAt, CreditCard, "text-rose-600"],
              ["Batas Payment", preview.estimatedPaymentClosesAt, CreditCard, "text-rose-600"],
              ["Estimasi Ready", preview.estimatedReadyAt, Truck, "text-emerald-600"],
            ] as const
          ).map(([label, value, Icon, color]) => (
            <div key={label} className="flex items-center gap-2">
              <Icon size={12} className={color} />
              <dt className="w-32 text-xs text-slate-500">{label}</dt>
              <dd className="text-xs font-semibold text-slate-900">
                {dates.format(new Date(value))}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Pickup Location */}
      <section className="rounded-lg border border-white bg-white p-4 shadow-sm">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-900">
          <MapPin size={14} className="text-orange-500" />
          Lokasi Pengambilan
        </h4>
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-slate-900">{preview.pickupName}</p>
          <p className="text-slate-600">{preview.pickupAddress}</p>
        </div>
      </section>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-100/50 p-3 text-xs text-blue-800">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <p>
          Batch ini akan diterbitkan otomatis sesuai jadwal. Anda akan menerima
          notifikasi H-1 untuk melakukan review sebelum tayang.
        </p>
      </div>
    </div>
  );
}
