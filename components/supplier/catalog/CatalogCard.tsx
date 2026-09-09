"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Package, Users } from "lucide-react";
import type { SupplierBatchDetail, SupplierBatchStatus } from "@/lib/supplier-batch/types";
import { isAllowedSupplierProductImageUrl } from "@/lib/supplier-catalog/image";

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dates = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

function progressFor(registered: number, target: number): number {
  return target <= 0 ? 0 : Math.min(100, Math.max(0, (registered / target) * 100));
}

const STATUS_LABELS: Record<SupplierBatchStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Aktif",
  CLOSED: "Pendaftaran ditutup",
  CANCELLED_BY_SUPPLIER: "Dibatalkan",
  TAKEDOWN: "Diturunkan",
  COMPLETED: "Selesai",
};

function statusClasses(status: SupplierBatchStatus): string {
  if (status === "CANCELLED_BY_SUPPLIER" || status === "TAKEDOWN") return "bg-slate-800/80 text-white";
  if (status === "DRAFT") return "bg-amber-500/90 text-white";
  if (status === "COMPLETED" || status === "CLOSED") return "bg-indigo-600/90 text-white";
  return "bg-emerald-600/90 text-white";
}

export interface CatalogCardProps { batch: SupplierBatchDetail; }

export default function CatalogCard({ batch }: CatalogCardProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageUrl = batch.imageUrl.trim();
  const canRenderImage = isAllowedSupplierProductImageUrl(imageUrl) && failedImageUrl !== imageUrl;
  const inactive = batch.status !== "PUBLISHED";
  const progress = progressFor(batch.registeredQuantity, batch.targetQuantity);
  const lowest = batch.tiers.at(-1)?.pricePerUnit ?? batch.basePrice;
  const date = new Date(batch.timeline.registrationOpensAt);
  const StatusIcon = batch.status === "CANCELLED_BY_SUPPLIER" || batch.status === "TAKEDOWN" ? AlertCircle : batch.status === "DRAFT" ? Clock3 : batch.status === "PUBLISHED" ? CheckCircle2 : Package;

  return (
    <Link href={`/supplier/batch/${batch.id}`} className="group block rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-t-xl bg-slate-100">
        {canRenderImage ? (
          <Image
            src={imageUrl}
            alt={"Foto produk " + batch.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            onError={() => setFailedImageUrl(imageUrl)}
          />
        ) : <Package aria-hidden="true" size={32} className="text-slate-300" />}
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold backdrop-blur-sm ${statusClasses(batch.status)}`}>
          <StatusIcon aria-hidden="true" size={12} /> {STATUS_LABELS[batch.status]}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-700 backdrop-blur-sm">{batch.category}</span>
      </div>

      <div className="p-4">
        <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-blue-700">{batch.title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{batch.displayCode}</p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-bold text-blue-700">{money.format(lowest)}</span>
          {lowest < batch.basePrice && <span className="text-xs text-slate-400 line-through">{money.format(batch.basePrice)}</span>}
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500"><span className="flex items-center gap-1"><Users aria-hidden="true" size={12} /> {batch.participantCount} peserta</span><span>{batch.registeredQuantity}/{batch.targetQuantity} pcs</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${inactive ? "bg-slate-300" : "bg-blue-500"}`} style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="truncate">{batch.pickup.name}</span>
          <span className="shrink-0">{Number.isNaN(date.getTime()) ? "-" : dates.format(date)}</span>
        </div>
      </div>
    </Link>
  );
}