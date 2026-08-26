"use client";

import type { ReactNode, RefObject } from "react";
import { Eye, EyeOff, Mail, Phone, User } from "lucide-react";
import type { FieldErrors } from "@/lib/supplier-registration/contracts";
import type { SupplierRegistrationReviewForm } from "@/lib/supplier-registration/review";

export interface AccountStepProps {
  value: SupplierRegistrationReviewForm;
  errors: FieldErrors;
  disabled: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onFieldChange: (field: keyof SupplierRegistrationReviewForm, value: string) => void;
}

export default function AccountStep({
  value,
  errors,
  disabled,
  headingRef,
  onFieldChange,
}: AccountStepProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  return (
    <section aria-labelledby="supplier-registration-account-title">
      <StepHeader
        headingRef={headingRef}
        title="Buat akun pemasok"
        description="Isi identitas pemilik dan kredensial akun Anda."
        step="Langkah 1 dari 4"
      />

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Field label="Nama Lengkap" icon={<User className="h-4 w-4" />} htmlFor="fullName" error={errors.fullName}>
          <input
            id="fullName"
            value={value.fullName}
            onChange={(event) => onFieldChange("fullName", event.target.value)}
            className={inputClass(Boolean(errors.fullName))}
            placeholder="Nama lengkap Anda"
            autoComplete="name"
            required
            disabled={disabled}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
          />
        </Field>

        <Field label="Nomor WhatsApp" icon={<Phone className="h-4 w-4" />} htmlFor="phone" error={errors.phone}>
          <input
            id="phone"
            value={value.phone}
            onChange={(event) => onFieldChange("phone", event.target.value)}
            className={inputClass(Boolean(errors.phone))}
            placeholder="081234567890"
            autoComplete="tel"
            inputMode="tel"
            required
            disabled={disabled}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : undefined}
          />
        </Field>

        <Field
          label="Email"
          icon={<Mail className="h-4 w-4" />}
          htmlFor="email"
          error={errors.email}
          helper="Gunakan format email aktif, contoh nama@gmail.com."
        >
          <input
            id="email"
            type="email"
            value={value.email}
            onChange={(event) => onFieldChange("email", event.target.value)}
            className={inputClass(Boolean(errors.email))}
            placeholder="alamat@email.com"
            autoComplete="email"
            required
            disabled={disabled}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : "email-help"}
          />
        </Field>

        <div className="hidden sm:block" aria-hidden="true" />

        <Field label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            value={value.password}
            visible={showPassword}
            disabled={disabled}
            error={errors.password}
            placeholder="Minimal 8 karakter"
            ariaLabel={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            onChange={(nextValue) => onFieldChange("password", nextValue)}
            onToggle={() => setShowPassword((visible) => !visible)}
          />
        </Field>

        <Field label="Konfirmasi Password" htmlFor="confirmPassword" error={errors.confirmPassword}>
          <PasswordInput
            id="confirmPassword"
            value={value.confirmPassword}
            visible={showConfirmPassword}
            disabled={disabled}
            error={errors.confirmPassword}
            placeholder="Ulangi password"
            ariaLabel={showConfirmPassword ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"}
            onChange={(nextValue) => onFieldChange("confirmPassword", nextValue)}
            onToggle={() => setShowConfirmPassword((visible) => !visible)}
          />
        </Field>
      </div>
    </section>
  );
}

function PasswordInput({
  id,
  value,
  visible,
  disabled,
  error,
  placeholder,
  ariaLabel,
  onChange,
  onToggle,
}: {
  id: string;
  value: string;
  visible: boolean;
  disabled: boolean;
  error?: string;
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass(Boolean(error))} pr-12`}
        placeholder={placeholder}
        autoComplete="new-password"
        required
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="absolute inset-y-0 right-0 mt-2 flex min-h-11 items-center px-3 text-slate-400 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={ariaLabel}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );
}

function StepHeader({
  headingRef,
  title,
  description,
  step,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  title: string;
  description: string;
  step: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 ref={headingRef} id="supplier-registration-account-title" tabIndex={-1} className="text-2xl font-bold tracking-tight text-slate-950 outline-none sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">{step}</span>
    </div>
  );
}

function Field({
  label,
  icon,
  htmlFor,
  error,
  helper,
  children,
}: {
  label: string;
  icon?: ReactNode;
  htmlFor: string;
  error?: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {helper && <p id={`${htmlFor}-help`} className="mt-1.5 text-xs text-slate-500">{helper}</p>}
      {error && <p id={`${htmlFor}-error`} className="mt-1.5 text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `block w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 ${hasError ? "border-red-400 bg-red-50/30" : "border-slate-200 bg-white"}`;
}

import * as React from "react";
