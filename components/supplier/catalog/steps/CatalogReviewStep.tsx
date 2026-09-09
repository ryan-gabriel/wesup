"use client";

import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Package,
  TrendingDown,
  Truck,
} from "lucide-react";
import type { CatalogDraft } from "@/lib/supplier-catalog/types";

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

interface CatalogReviewStepProps {
  draft: CatalogDraft;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

export default function CatalogReviewStep({
  draft,
  headingRef,
}: CatalogReviewStepProps) {
  const lowestPrice = draft.tiers.at(-1)?.pricePerUnit ?? 0;
  const highestPrice = draft.tiers.at(0)?.pricePerUnit ?? 0;

  return (
    <div className="space-y-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold text-slate-900 outline-none"
      >
        Tinjauan Penawaran
      </h2>
      <p className="text-sm text-slate-500">
        Pastikan semua informasi sudah benar sebelum menerbitkan penawaran.
      </p>

      {/* Status */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-blue-600" />
          <p className="text-sm font-medium text-blue-800">
            Penawaran ini akan langsung tayang di marketplace setelah diterbitkan.
          </p>
        </div>
      </div>

      {/* Product Info */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Package size={16} className="text-blue-500" />
          Detail Produk
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Nama Produk</dt>
            <dd className="font-semibold text-slate-900">{draft.title}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Kategori</dt>
            <dd>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                {draft.category}
              </span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Deskripsi</dt>
            <dd className="max-w-xs text-right text-slate-900">
              {draft.description}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Foto Produk</dt>
            <dd className="flex items-center gap-1 font-medium text-emerald-600">
              <CheckCircle2 size={14} />
              {draft.productPhoto?.name ?? "Terkirim"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Tier Pricing */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <TrendingDown size={16} className="text-blue-500" />
          Skema Harga Tier
        </h3>
        <div className="mb-3 flex items-baseline gap-3">
          <span className="text-xl font-bold text-blue-700">
            {money.format(lowestPrice)}
          </span>
          {lowestPrice < highestPrice && (
            <span className="text-sm text-slate-400 line-through">
              {money.format(highestPrice)}
            </span>
          )}
        </div>
        <ul className="space-y-1 text-sm">
          {draft.tiers.map((tier) => (
            <li key={tier.tierNumber} className="flex justify-between">
              <span className="text-slate-600">
                Tier {tier.tierNumber}: {tier.minimumQuantity}–{tier.maximumQuantity ?? "+"} pcs
              </span>
              <strong className="text-slate-900">{money.format(tier.pricePerUnit)}</strong>
            </li>
          ))}
        </ul>
      </section>

      {/* Timeline */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Clock size={16} className="text-indigo-500" />
          Timeline
        </h3>
        <dl className="space-y-2 text-sm">
          {(
            [
              ["Buka Pendaftaran", draft.registrationOpensAt, Calendar, "text-indigo-600"],
              ["Tutup Pendaftaran", draft.registrationClosesAt, Clock, "text-indigo-600"],
              ["Mulai Payment", draft.paymentOpensAt, CreditCard, "text-rose-600"],
              ["Batas Payment", draft.paymentClosesAt, CreditCard, "text-rose-600"],
              ["Estimasi Ready", draft.estimatedReadyAt, Truck, "text-emerald-600"],
            ] as const
          ).map(([label, value, Icon, color]) => (
            <div key={label} className="flex items-center gap-3">
              <Icon size={14} className={color} />
              <dt className="w-36 text-slate-500">{label}</dt>
              <dd className="font-semibold text-slate-900">
                {value ? dates.format(new Date(value)) : "Belum diatur"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Pickup Location */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <MapPin size={16} className="text-orange-500" />
          Lokasi Pengambilan
        </h3>
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-slate-900">{draft.pickupName}</p>
          <p className="text-slate-600">{draft.pickupAddress}</p>
          {draft.pickupLatitude !== null && draft.pickupLongitude !== null && (
            <p className="font-mono text-xs text-slate-500">
              Koordinat: {draft.pickupLatitude.toFixed(5)}, {draft.pickupLongitude.toFixed(5)}
            </p>
          )}
        </div>
      </section>

      {/* Recurring */}
      {draft.recurring.enabled && (
        <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-indigo-900">
            <CalendarClock size={16} className="text-indigo-500" />
            Postingan Berulang
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-indigo-700">Nama Jadwal</dt>
              <dd className="font-semibold text-indigo-950">{draft.recurring.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-indigo-700">Interval</dt>
              <dd className="font-semibold text-indigo-950">
                Setiap {draft.recurring.intervalDays} hari
                {draft.recurring.daysOfWeek.length > 0 && (
                  <>
                    {" "}
                    &middot;{" "}
                    {draft.recurring.daysOfWeek
                      .sort((a, b) => a - b)
                      .map((d) => ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][d])
                      .join(", ")}
                  </>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-3 rounded-lg bg-white/60 p-3 text-xs text-indigo-800">
            Setelah penawaran ini tayang, batch berikutnya akan di-generate otomatis
            sesuai jadwal. Anda akan menerima notifikasi H-1 untuk review.
          </p>
        </section>
      )}
    </div>
  );
}
