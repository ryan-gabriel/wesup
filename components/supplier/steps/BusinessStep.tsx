"use client";

import type { ReactNode, RefObject } from "react";
import { Briefcase, MapPin } from "lucide-react";
import type { FieldErrors } from "@/lib/supplier-registration/contracts";
import type { SupplierRegistrationReviewForm } from "@/lib/supplier-registration/review";

export interface BusinessStepProps {
  value: SupplierRegistrationReviewForm;
  errors: FieldErrors;
  disabled: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onFieldChange: (field: keyof SupplierRegistrationReviewForm, value: string) => void;
}

export default function BusinessStep({
  value,
  errors,
  disabled,
  headingRef,
  onFieldChange,
}: BusinessStepProps) {
  return (
    <section aria-labelledby="supplier-registration-business-title">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 ref={headingRef} id="supplier-registration-business-title" tabIndex={-1} className="text-2xl font-bold tracking-tight text-slate-950 outline-none sm:text-3xl">
            Ceritakan usaha Anda
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Lengkapi nama dan alamat tempat usaha.</p>
        </div>
        <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Langkah 2 dari 4</span>
      </div>

      <div className="mt-8 space-y-6">
        <Field label="Nama Usaha" icon={<Briefcase className="h-4 w-4" />} htmlFor="businessName" error={errors.businessName}>
          <input
            id="businessName"
            value={value.businessName}
            onChange={(event) => onFieldChange("businessName", event.target.value)}
            className={inputClass(Boolean(errors.businessName))}
            placeholder="Contoh: Toko Pangan Jaya"
            autoComplete="organization"
            required
            disabled={disabled}
            aria-invalid={Boolean(errors.businessName)}
            aria-describedby={errors.businessName ? "businessName-error" : undefined}
          />
        </Field>

        <Field label="Alamat Lengkap" icon={<MapPin className="h-4 w-4" />} htmlFor="address" error={errors.address}>
          <textarea
            id="address"
            value={value.address}
            onChange={(event) => onFieldChange("address", event.target.value)}
            className={`${inputClass(Boolean(errors.address))} resize-y`}
            rows={4}
            placeholder="Alamat tempat usaha beserta kecamatan dan kode pos"
            autoComplete="street-address"
            required
            disabled={disabled}
            aria-invalid={Boolean(errors.address)}
            aria-describedby={errors.address ? "address-error" : undefined}
          />
        </Field>
      </div>
    </section>
  );
}

function Field({
  label,
  icon,
  htmlFor,
  error,
  children,
}: {
  label: string;
  icon?: ReactNode;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error && <p id={`${htmlFor}-error`} className="mt-1.5 text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `block w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 ${hasError ? "border-red-400 bg-red-50/30" : "border-slate-200 bg-white"}`;
}
