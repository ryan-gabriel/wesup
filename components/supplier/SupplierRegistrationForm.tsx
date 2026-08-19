"use client";

import { useCallback, useState } from "react";
import { Briefcase, CheckCircle2, Eye, EyeOff, LoaderCircle, Mail, MapPin, Phone, User } from "lucide-react";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";
import { normalizeEmail, validateEmailFormat, type FieldErrors, type RegistrationSuccessResponse } from "@/lib/supplier-registration/contracts";
import BusinessPhotoField from "@/components/supplier/BusinessPhotoField";
import RegistrationReviewDialog from "@/components/supplier/RegistrationReviewDialog";
import RegistrationSuccessDialog from "@/components/supplier/RegistrationSuccessDialog";
import { SupplierLocationMapClient } from "@/components/supplier/SupplierLocationMapClient";
import { buildSupplierRegistrationReview, type SupplierRegistrationReview } from "@/lib/supplier-registration/review";

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  address: string;
}

type RegistrationStage = "editing" | "reviewing" | "submitting" | "success";

const initialForm: FormState = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  businessName: "",
  address: "",
};

export default function SupplierRegistrationForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [coordinate, setCoordinate] = useState<MapCoordinate | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | undefined>();
  const [stage, setStage] = useState<RegistrationStage>("editing");
  const [review, setReview] = useState<SupplierRegistrationReview | null>(null);
  const submitting = stage === "submitting";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState<RegistrationSuccessResponse | null>(null);


  const closeSuccess = useCallback(() => setSuccess(null), []);

  const returnToEditing = useCallback(() => {
    if (stage === "submitting") return;
    setReview(null);
    setStage("editing");
  }, [stage]);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === "password" ? { confirmPassword: undefined } : {}),
    }));
    setGlobalError(undefined);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage !== "editing") return;
    const emailFormatError = validateEmailFormat(form.email);
    if (emailFormatError) {
      setFieldErrors((current) => ({ ...current, email: emailFormatError }));
      document.getElementById("email")?.focus();
      return;
    }
    if (form.password.length < 8) {
      setFieldErrors((current) => ({ ...current, password: "Password minimal 8 karakter." }));
      document.getElementById("password")?.focus();
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFieldErrors((current) => ({ ...current, confirmPassword: "Konfirmasi password tidak sama." }));
      document.getElementById("confirmPassword")?.focus();
      return;
    }
    if (!coordinate) {
      setFieldErrors((current) => ({ ...current, location: "Titik lokasi usaha wajib dipilih pada peta." }));
      document.getElementById("supplier-location")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!photo) {
      setFieldErrors((current) => ({ ...current, businessPhoto: "Foto tempat usaha wajib diunggah." }));
      document.getElementById("business-photo")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setFieldErrors({});
    setGlobalError(undefined);
    setReview(buildSupplierRegistrationReview({ form, coordinate, photo }));
    setStage("reviewing");
  }

  async function confirmRegistration() {
    if (stage !== "reviewing" || !coordinate || !photo) return;

    setStage("submitting");
    setFieldErrors({});
    setGlobalError(undefined);
    const payload = new FormData();
    payload.set("fullName", form.fullName.trim());
    payload.set("email", normalizeEmail(form.email));
    payload.set("phone", form.phone.trim());
    payload.set("password", form.password);
    payload.set("confirmPassword", form.confirmPassword);
    payload.set("businessName", form.businessName.trim());
    payload.set("address", form.address.trim());
    payload.set("latitude", String(coordinate.lat));
    payload.set("longitude", String(coordinate.lng));
    payload.set("businessPhoto", photo);

    try {
      const response = await fetch("/api/suppliers/register", { method: "POST", body: payload });
      const body = (await response.json()) as Partial<RegistrationSuccessResponse> & { error?: string; fieldErrors?: FieldErrors };
      if (!response.ok) {
        setFieldErrors(body.fieldErrors ?? {});
        setGlobalError(body.error ?? "Pendaftaran belum dapat diproses. Coba lagi.");
        const firstError = Object.keys(body.fieldErrors ?? {})[0];
        if (firstError) document.getElementById(firstError === "location" ? "supplier-location" : firstError === "businessPhoto" ? "business-photo" : firstError)?.focus();
        setReview(null);
        setStage("editing");
        return;
      }
      setSuccess(body as RegistrationSuccessResponse);
      setForm(initialForm);
      setCoordinate(null);
      setPhoto(null);
      setReview(null);
      setStage("success");
    } catch {
      setGlobalError("Koneksi bermasalah. Periksa internet Anda lalu coba lagi.");
      setReview(null);
      setStage("editing");
    }
  }

  const inputClass = (field: keyof FormState) => `mt-2 block w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${fieldErrors[field] ? "border-red-400 bg-red-50/30" : "border-slate-200 bg-white"}`;
  const error = (field: keyof FieldErrors) => fieldErrors[field] ? <p id={`${field}-error`} className="mt-1.5 text-xs font-medium text-red-600" role="alert">{fieldErrors[field]}</p> : null;

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        {globalError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{globalError}</div>}

        <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">01 · Data pemilik</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Nama Lengkap" icon={<User className="h-4 w-4" />} htmlFor="fullName" error={error("fullName")}>
              <input id="fullName" value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} className={inputClass("fullName")} placeholder="Nama lengkap Anda" autoComplete="name" />
            </Field>
            <Field label="Nomor WhatsApp" icon={<Phone className="h-4 w-4" />} htmlFor="phone" error={error("phone")}>
              <input id="phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputClass("phone")} placeholder="081234567890" autoComplete="tel" inputMode="tel" />
            </Field>
            <Field label="Email" icon={<Mail className="h-4 w-4" />} htmlFor="email" error={error("email") || <p className="mt-1.5 text-xs text-slate-500">Gunakan format email aktif, contoh nama@gmail.com.</p>}>
              <input id="email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} className={inputClass("email")} placeholder="alamat@email.com" autoComplete="email" aria-describedby="email-error" />
            </Field>
            <div />
            <Field label="Password" htmlFor="password" error={error("password")}>
              <div className="relative">
                <input id="password" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => updateField("password", e.target.value)} className={`${inputClass("password")} pr-12`} placeholder="Minimal 8 karakter" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 mt-2 flex items-center px-3 text-slate-400 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>
            </Field>
            <Field label="Konfirmasi Password" htmlFor="confirmPassword" error={error("confirmPassword")}>
              <div className="relative">
                <input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} className={`${inputClass("confirmPassword")} pr-12`} placeholder="Ulangi password" autoComplete="new-password" />
                <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute inset-y-0 right-0 mt-2 flex items-center px-3 text-slate-400 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={showConfirmPassword ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"} aria-pressed={showConfirmPassword}>
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">02 · Data usaha</p>
          <div className="mt-5 space-y-5">
            <Field label="Nama Usaha" icon={<Briefcase className="h-4 w-4" />} htmlFor="businessName" error={error("businessName")}>
              <input id="businessName" value={form.businessName} onChange={(e) => updateField("businessName", e.target.value)} className={inputClass("businessName")} placeholder="Contoh: Toko Pangan Jaya" />
            </Field>
            <Field label="Alamat Lengkap" icon={<MapPin className="h-4 w-4" />} htmlFor="address" error={error("address")}>
              <textarea id="address" value={form.address} onChange={(e) => updateField("address", e.target.value)} className={`${inputClass("address")} resize-y`} rows={3} placeholder="Alamat tempat usaha beserta kode pos" />
            </Field>
          </div>
        </section>

        <section id="supplier-location" className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">03 · Lokasi & foto</p>
          <div className="mt-5">
            <SupplierLocationMapClient value={coordinate} onChange={(value) => { setCoordinate(value); setFieldErrors((current) => ({ ...current, location: undefined })); }} error={fieldErrors.location} disabled={submitting} />
          </div>
          <div id="business-photo" className="mt-7">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MapPin className="h-4 w-4 text-slate-400" /> Foto Fisik Tempat Usaha</label>
            <div className="mt-3"><BusinessPhotoField value={photo} onChange={(value) => { setPhoto(value); setFieldErrors((current) => ({ ...current, businessPhoto: undefined })); }} error={fieldErrors.businessPhoto} disabled={submitting} /></div>
          </div>
        </section>

        <div className="border-t border-slate-100 pt-6">
          <button type="submit" disabled={stage !== "editing"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
            {submitting ? "Mengirim pendaftaran…" : "Kirim Pendaftaran"}
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">Dengan mendaftar, Anda menyetujui Syarat & Ketentuan serta Kebijakan Privasi Wesup.</p>
        </div>
      </form>
      <RegistrationReviewDialog
        open={stage === "reviewing" || stage === "submitting"}
        review={review}
        photo={photo}
        password={form.password}
        submitting={submitting}
        onBack={returnToEditing}
        onConfirm={confirmRegistration}
      />
      <RegistrationSuccessDialog open={success !== null} requiresEmailConfirmation={success?.requiresEmailConfirmation ?? false} onClose={closeSuccess} />
    </>
  );
}

function Field({ label, icon, htmlFor, error, children }: { label: string; icon?: React.ReactNode; htmlFor: string; error?: React.ReactNode; children: React.ReactNode }) {
  return <div><label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-semibold text-slate-700">{icon && <span className="text-slate-400">{icon}</span>}{label}</label>{children}{error}</div>;
}
