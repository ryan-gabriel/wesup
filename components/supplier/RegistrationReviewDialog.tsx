"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Eye, EyeOff, LoaderCircle, MapPin, X } from "lucide-react";
import { formatCoordinate } from "@/lib/maps/leaflet-demo";
import type { SupplierRegistrationReview } from "@/lib/supplier-registration/review";
import { formatFileSize } from "@/components/supplier/BusinessPhotoField";

export interface RegistrationReviewDialogProps {
  open: boolean;
  review: SupplierRegistrationReview | null;
  photo: File | null;
  password: string;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export default function RegistrationReviewDialog({
  open,
  review,
  photo,
  password,
  submitting,
  onBack,
  onConfirm,
}: RegistrationReviewDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const previewUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );

  const handleBack = useCallback(() => {
    setShowPassword(false);
    onBack();
  }, [onBack]);

  const handleConfirm = useCallback(() => {
    setShowPassword(false);
    onConfirm();
  }, [onConfirm]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) handleBack();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (!submitting) previousFocusRef.current?.focus();
    };
  }, [handleBack, open, submitting]);

  if (!open || !review) return null;

  function handleBackdropMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!submitting && event.target === event.currentTarget) handleBack();
  }

  const maskedPassword = password ? "\u2022".repeat(12) : "-";

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm sm:py-8"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-review-title"
        aria-describedby="registration-review-description"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleBack}
          disabled={submitting}
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Tutup dialog review"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <MapPin className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Konfirmasi pendaftaran</p>
        <h2 id="registration-review-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          Periksa kembali data Anda
        </h2>
        <p id="registration-review-description" className="mt-3 text-sm leading-6 text-slate-600">
          Pastikan semua informasi berikut sudah benar sebelum dikirim.
        </p>

        <div className="mt-6 space-y-6">
          <section aria-labelledby="review-owner-title">
            <h3 id="review-owner-title" className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Data pemilik
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ReviewItem label="Nama lengkap" value={review.fullName} />
              <ReviewItem label="Nomor WhatsApp" value={review.phone} />
              <ReviewItem label="Email" value={review.email} />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="min-w-0 break-all text-sm font-semibold text-slate-900">
                    {showPassword ? password : maskedPassword}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-blue-100 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="review-business-title">
            <h3 id="review-business-title" className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Data usaha
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ReviewItem label="Nama usaha" value={review.businessName} />
              <ReviewItem label="Alamat lengkap" value={review.address} className="sm:col-span-2" />
            </div>
          </section>

          <section aria-labelledby="review-location-title">
            <h3 id="review-location-title" className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Lokasi dan foto usaha
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ReviewItem label="Titik lokasi" value={formatCoordinate(review.coordinate)} />
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Camera className="h-4 w-4 text-blue-600" aria-hidden="true" />
                Foto usaha
              </div>
              <div className="mt-3 flex items-center gap-4">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Pratinjau foto usaha" className="h-20 w-24 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-20 w-24 items-center justify-center rounded-xl bg-slate-200 text-slate-400">
                    <Camera className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{review.photo.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {review.photo.type || "Foto"} / {formatFileSize(review.photo.size)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-slate-800">Apakah data di atas sudah benar?</p>
        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tidak, periksa kembali
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Mengirim pendaftaran..." : "Ya, lanjutkan pendaftaran"}
          </button>
        </div>
      </div>
    </div>
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
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 p-4 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}
