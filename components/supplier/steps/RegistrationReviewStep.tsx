"use client";

import { useEffect, useMemo, type ReactNode, type RefObject } from "react";
import { Camera, CheckCircle2, Pencil } from "lucide-react";
import { formatCoordinate } from "@/lib/maps/leaflet-demo";
import type { SupplierRegistrationReview } from "@/lib/supplier-registration/review";
import { formatFileSize } from "@/components/supplier/BusinessPhotoField";
import type { SupplierRegistrationStep } from "@/lib/supplier-registration/steps";

export interface RegistrationReviewStepProps {
  review: SupplierRegistrationReview;
  photo: File;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onEdit: (step: Exclude<SupplierRegistrationStep, 4>) => void;
}

export default function RegistrationReviewStep({
  review,
  photo,
  headingRef,
  onEdit,
}: RegistrationReviewStepProps) {
  const previewUrl = useMemo(() => URL.createObjectURL(photo), [photo]);

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <section aria-labelledby="supplier-registration-review-title">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 ref={headingRef} id="supplier-registration-review-title" tabIndex={-1} className="text-2xl font-bold tracking-tight text-slate-950 outline-none sm:text-3xl">
            Tinjauan Akhir
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Periksa kembali semua informasi sebelum mengirim pendaftaran.</p>
        </div>
        <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Langkah 4 dari 4</span>
      </div>

      <div className="mt-8 space-y-5">
        <ReviewSection title="Informasi Akun" editLabel="Edit informasi akun" onEdit={() => onEdit(1)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <ReviewItem label="Nama lengkap" value={review.fullName} />
            <ReviewItem label="Nomor WhatsApp" value={review.phone} />
            <ReviewItem label="Email" value={review.email} />
            <ReviewItem label="Password" value="Password telah diisi" />
          </div>
        </ReviewSection>

        <ReviewSection title="Data Usaha" editLabel="Edit data usaha" onEdit={() => onEdit(2)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <ReviewItem label="Nama usaha" value={review.businessName} />
            <ReviewItem label="Alamat lengkap" value={review.address} className="sm:col-span-2" />
          </div>
        </ReviewSection>

        <ReviewSection title="Lokasi & Foto" editLabel="Edit lokasi dan foto" onEdit={() => onEdit(3)}>
          <ReviewItem label="Titik lokasi" value={formatCoordinate(review.coordinate)} />
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Camera className="h-4 w-4 text-blue-600" aria-hidden="true" />
              Foto usaha
            </div>
            <div className="mt-3 flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Pratinjau foto tempat usaha" className="h-20 w-24 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{review.photo.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {review.photo.type || "Foto"} · {formatFileSize(review.photo.size)}
                </p>
              </div>
            </div>
          </div>
        </ReviewSection>
      </div>

      <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-4 text-sm text-blue-950">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
          <p>Apakah data di atas sudah benar?</p>
        </div>
        <p className="mt-2 pl-8 text-xs leading-5 text-blue-800">Anda masih dapat kembali dan mengedit setiap bagian sebelum mengirim.</p>
      </div>
    </section>
  );
}

function ReviewSection({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={editLabel}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ReviewItem({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-3.5 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}
