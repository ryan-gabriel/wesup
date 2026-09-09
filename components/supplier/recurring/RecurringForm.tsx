"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  LoaderCircle,
  MapPin,
  Minus,
  Package,
  Plus,
  Save,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import {
  DAY_LABELS,
  DAY_SHORT_LABELS,
  INITIAL_RECURRING_DRAFT,
  type DayOfWeek,
  type FieldErrors,
  type RecurringConfigDraft,
  type RecurringDraftStep,
  type RecurringTierTemplate,
} from "@/lib/supplier-recurring/types";
import {
  initialRecurringFormState,
  recurringFormReducer,
} from "@/lib/supplier-recurring/state";
import RecurringStepper from "@/components/supplier/recurring/RecurringStepper";
import RecurringBatchPreviewCard from "@/components/supplier/recurring/RecurringBatchPreview";
import type { RecurringBatchPreview } from "@/lib/supplier-recurring/types";

function validateStep(
  step: RecurringDraftStep,
  draft: RecurringConfigDraft,
): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 1) {
    if (!draft.name.trim()) errors.name = "Nama jadwal wajib diisi.";
    if (draft.intervalDays < 1) errors.intervalDays = "Interval minimal 1 hari.";
    if (draft.daysOfWeek.length === 0 && draft.intervalDays > 1) {
      errors.daysOfWeek = "Pilih minimal satu hari dalam seminggu.";
    }
  }

  if (step === 2) {
    if (!draft.templateTitle.trim()) errors.templateTitle = "Nama produk wajib diisi.";
    if (!draft.templateCategory) errors.templateCategory = "Pilih kategori produk.";
    if (!draft.templateDescription.trim()) errors.templateDescription = "Deskripsi produk wajib diisi.";
    if (draft.templateTiers.length < 2) errors.templateTiers = "Minimal 2 tier harga.";
    for (let i = 0; i < draft.templateTiers.length; i++) {
      const tier = draft.templateTiers[i];
      if (tier.pricePerUnit <= 0) {
        errors[`templateTiers.${i}.pricePerUnit` as keyof FieldErrors] =
          `Harga Tier ${tier.tierNumber} wajib diisi.`;
      }
      if (i < draft.templateTiers.length - 1 && tier.maximumQuantity === null) {
        errors[`templateTiers.${i}.maximumQuantity` as keyof FieldErrors] =
          `Kuantitas maksimum Tier ${tier.tierNumber} wajib diisi.`;
      }
    }
    for (let i = 1; i < draft.templateTiers.length; i++) {
      if (draft.templateTiers[i].pricePerUnit >= draft.templateTiers[i - 1].pricePerUnit) {
        errors.templateTierInversion = "Harga tier harus menurun seiring kuantitas naik.";
        break;
      }
    }
    for (let i = 1; i < draft.templateTiers.length; i++) {
      const prevMax = draft.templateTiers[i - 1].maximumQuantity ?? Infinity;
      if (draft.templateTiers[i].minimumQuantity <= prevMax) {
        errors.templateTierOverlap = "Rentang kuota antar tier tidak boleh overlap.";
        break;
      }
    }
    if (!draft.templatePickupName.trim()) errors.templatePickupName = "Nama lokasi wajib diisi.";
    if (!draft.templatePickupAddress.trim()) errors.templatePickupAddress = "Alamat wajib diisi.";
    if (draft.templatePickupLatitude === null || draft.templatePickupLongitude === null) {
      errors.templateCoordinate = "Pin peta wajib dipilih.";
    }
  }

  return errors;
}

function buildPreview(draft: RecurringConfigDraft): RecurringBatchPreview {
  const now = new Date();
  const baseDate = new Date(now);
  baseDate.setDate(baseDate.getDate() + draft.intervalDays);

  const opensAt = new Date(baseDate);
  opensAt.setHours(1, 0, 0, 0);

  const closesAt = new Date(opensAt);
  closesAt.setDate(closesAt.getDate() + 7);
  closesAt.setHours(10, 0, 0, 0);

  const payOpens = new Date(closesAt);
  payOpens.setSeconds(1);

  const payCloses = new Date(payOpens);
  payCloses.setDate(payCloses.getDate() + 1);
  payCloses.setHours(8, 0, 0, 0);

  const readyAt = new Date(payCloses);
  readyAt.setDate(readyAt.getDate() + 3);
  readyAt.setHours(2, 0, 0, 0);

  return {
    configId: "preview",
    configName: draft.name,
    templateTitle: draft.templateTitle || "Nama Produk",
    category: (draft.templateCategory || "Makanan Siap Saji") as RecurringBatchPreview["category"],
    estimatedRegistrationOpensAt: opensAt.toISOString(),
    estimatedRegistrationClosesAt: closesAt.toISOString(),
    estimatedPaymentOpensAt: payOpens.toISOString(),
    estimatedPaymentClosesAt: payCloses.toISOString(),
    estimatedReadyAt: readyAt.toISOString(),
    tiers: draft.templateTiers,
    pickupName: draft.templatePickupName || "Lokasi Pengambilan",
    pickupAddress: draft.templatePickupAddress || "Alamat lokasi",
  };
}

export default function RecurringForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<RecurringConfigDraft>(INITIAL_RECURRING_DRAFT);
  const [currentStep, setCurrentStep] = useState<RecurringDraftStep>(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string>();
  const [formState, formDispatch] = useReducer(
    recurringFormReducer,
    initialRecurringFormState,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<RecurringDraftStep>(1);

  const submitting = formState.submitPhase !== "idle";

  useEffect(() => {
    if (previousStepRef.current === currentStep) return;
    previousStepRef.current = currentStep;
    window.setTimeout(() => {
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [currentStep]);

  const updateField = useCallback(
    (field: keyof RecurringConfigDraft, value: string | number | boolean | DayOfWeek[]) => {
      setDraft((d) => ({ ...d, [field]: value }));
      setErrors((e) => ({ ...e, [field]: undefined }));
      setGlobalError(undefined);
    },
    [],
  );

  const goBack = useCallback(() => {
    if (submitting || currentStep === 1) return;
    setGlobalError(undefined);
    setCurrentStep((s) => (s - 1) as RecurringDraftStep);
  }, [currentStep, submitting]);

  const goNext = useCallback(() => {
    if (currentStep === 3 || submitting) return false;
    const stepErrors = validateStep(currentStep, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((e) => ({ ...e, ...stepErrors }));
      setGlobalError(undefined);
      focusFirstError(stepErrors);
      return false;
    }
    setErrors({});
    setGlobalError(undefined);
    setCurrentStep((s) => (s + 1) as RecurringDraftStep);
    return true;
  }, [currentStep, draft, submitting]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (currentStep < 3) {
        goNext();
        return;
      }
      if (submitting) return;

      formDispatch({ type: "submitStarted" });
      window.setTimeout(() => {
        formDispatch({ type: "submitSucceeded" });
      }, 1500);
    },
    [currentStep, goNext, submitting, formDispatch],
  );

  const handleSaveDraft = useCallback(() => {
    if (submitting) return;
    formDispatch({ type: "submitSucceeded" });
  }, [submitting, formDispatch]);

  const addTier = useCallback(() => {
    setDraft((d) => {
      const lastTier = d.templateTiers.at(-1);
      const newTierNumber = (lastTier?.tierNumber ?? 0) + 1;
      const newMin = (lastTier?.maximumQuantity ?? 0) + 1;
      return {
        ...d,
        templateTiers: [
          ...d.templateTiers,
          { tierNumber: newTierNumber, minimumQuantity: newMin, maximumQuantity: null, pricePerUnit: 0 },
        ],
      };
    });
  }, []);

  const removeTier = useCallback((index: number) => {
    setDraft((d) => ({
      ...d,
      templateTiers: d.templateTiers.filter((_, i) => i !== index).map((t, i) => ({
        ...t,
        tierNumber: i + 1,
      })),
    }));
  }, []);

  const updateTier = useCallback(
    (index: number, field: keyof RecurringTierTemplate, value: number | null) => {
      setDraft((d) => ({
        ...d,
        templateTiers: d.templateTiers.map((t, i) =>
          i === index ? { ...t, [field]: value } : t,
        ),
      }));
      setErrors((e) => {
        const next = { ...e };
        const key = `templateTiers.${index}.${field}` as keyof FieldErrors;
        delete next[key];
        return next;
      });
    },
    [],
  );

  const toggleDay = useCallback((day: DayOfWeek) => {
    setDraft((d) => ({
      ...d,
      daysOfWeek: d.daysOfWeek.includes(day)
        ? d.daysOfWeek.filter((d) => d !== day)
        : [...d.daysOfWeek, day].sort((a, b) => a - b),
    }));
    setErrors((e) => ({ ...e, daysOfWeek: undefined }));
  }, []);

  const preview = buildPreview(draft);
  const lowestPrice = draft.templateTiers.at(-1)?.pricePerUnit ?? 0;
  const highestPrice = draft.templateTiers.at(0)?.pricePerUnit ?? 0;

  return (
    <>
      <RecurringStepper currentStep={currentStep} />

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-8 lg:p-10"
      >
        {globalError && (
          <div
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            role="alert"
          >
            {globalError}
          </div>
        )}

        {/* STEP 1: Jadwal & Interval */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold text-slate-900 outline-none"
            >
              Jadwal & Interval
            </h2>
            <p className="text-sm text-slate-500">
              Atur seberapa sering penawaran akan tayang secara otomatis.
            </p>

            {errors.name && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="alert">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-800">{errors.name}</p>
                </div>
              </div>
            )}

            {/* Nama Jadwal */}
            <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="mt-1 shrink-0">
                <Sparkles size={20} className="text-blue-600" />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="recurring-name" className="text-sm font-semibold text-slate-800">
                  Nama Jadwal <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-500">
                  Contoh: &quot;Beras Rojolele Mingguan&quot;
                </p>
                <input
                  id="recurring-name"
                  type="text"
                  required
                  value={draft.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  disabled={submitting}
                  placeholder="Masukkan nama jadwal..."
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Interval */}
            <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="mt-1 shrink-0">
                <Clock size={20} className="text-indigo-600" />
              </span>
              <div className="min-w-0 flex-1">
                <label htmlFor="recurring-interval" className="text-sm font-semibold text-slate-800">
                  Interval Pengulangan <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-500">
                  Berapa hari antara setiap batch yang di-generate.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="recurring-interval"
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={draft.intervalDays}
                    onChange={(e) => updateField("intervalDays", Number(e.target.value) || 1)}
                    disabled={submitting}
                    className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                  <span className="text-sm text-slate-600">hari</span>
                </div>
                {errors.intervalDays && (
                  <p className="mt-1 text-xs text-red-600">{errors.intervalDays}</p>
                )}
              </div>
            </div>

            {/* Days of Week */}
            {draft.intervalDays > 1 && (
              <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="mt-1 shrink-0">
                  <Calendar size={20} className="text-emerald-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <label className="text-sm font-semibold text-slate-800">
                    Hari Tayang
                  </label>
                  <p className="text-xs text-slate-500">
                    Pilih hari dalam seminggu untuk batch tayang (opsional jika interval harian).
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map((day) => {
                      const selected = draft.daysOfWeek.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          disabled={submitting}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            selected
                              ? "border border-blue-300 bg-blue-100 text-blue-700"
                              : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                          aria-pressed={selected}
                        >
                          <span className="hidden sm:inline">{DAY_LABELS[day]}</span>
                          <span className="sm:hidden">{DAY_SHORT_LABELS[day]}</span>
                        </button>
                      );
                    })}
                  </div>
                  {errors.daysOfWeek && (
                    <p className="mt-1 text-xs text-red-600">{errors.daysOfWeek}</p>
                  )}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="mt-1 shrink-0">
                <Info size={20} className="text-blue-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">Status Jadwal</p>
                <p className="text-xs text-slate-500">
                  Aktif: batch akan di-generate otomatis. Nonaktif: jadwal ditunda.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateField("isActive", true)}
                    disabled={submitting}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      draft.isActive
                        ? "border border-emerald-300 bg-emerald-100 text-emerald-700"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Aktif
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("isActive", false)}
                    disabled={submitting}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      !draft.isActive
                        ? "border border-slate-400 bg-slate-200 text-slate-800"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Nonaktif
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-4 text-xs text-blue-800">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Cara kerja:</p>
                <ul className="mt-1 space-y-0.5">
                  <li>&bull; Timestamp absolut batch dihitung otomatis dari interval yang diatur.</li>
                  <li>&bull; Anda akan menerima notifikasi H-1 sebelum batch tayang.</li>
                  <li>&bull; Batch baru hanya tayang setelah Anda mengkonfirmasi review.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Template Batch */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold text-slate-900 outline-none"
            >
              Template Batch
            </h2>
            <p className="text-sm text-slate-500">
              Isi detail produk yang akan digunakan sebagai template untuk setiap batch yang di-generate.
            </p>

            {/* Product Details */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="mt-1 shrink-0">
                  <Package size={20} className="text-blue-600" />
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <label htmlFor="tpl-title" className="text-sm font-semibold text-slate-800">
                      Nama Produk <span className="text-red-500">*</span>
                    </label>
                    {errors.templateTitle && (
                      <p className="mt-0.5 text-xs text-red-600">{errors.templateTitle}</p>
                    )}
                    <input
                      id="tpl-title"
                      type="text"
                      required
                      value={draft.templateTitle}
                      onChange={(e) => updateField("templateTitle", e.target.value)}
                      disabled={submitting}
                      placeholder="Contoh: Beras Rojolele 5 kg"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                    />
                  </div>

                  <div>
                    <label htmlFor="tpl-category" className="text-sm font-semibold text-slate-800">
                      Kategori <span className="text-red-500">*</span>
                    </label>
                    {errors.templateCategory && (
                      <p className="mt-0.5 text-xs text-red-600">{errors.templateCategory}</p>
                    )}
                    <select
                      id="tpl-category"
                      required
                      value={draft.templateCategory}
                      onChange={(e) => updateField("templateCategory", e.target.value)}
                      disabled={submitting}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                    >
                      <option value="">Pilih kategori...</option>
                      <option value="Makanan Siap Saji">Makanan Siap Saji</option>
                      <option value="Sayur & Buah">Sayur &amp; Buah</option>
                      <option value="Daging & Ikan">Daging &amp; Ikan</option>
                      <option value="Kerajinan">Kerajinan</option>
                      <option value="Jasa">Jasa</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="tpl-desc" className="text-sm font-semibold text-slate-800">
                      Deskripsi <span className="text-red-500">*</span>
                    </label>
                    {errors.templateDescription && (
                      <p className="mt-0.5 text-xs text-red-600">{errors.templateDescription}</p>
                    )}
                    <textarea
                      id="tpl-desc"
                      required
                      rows={3}
                      value={draft.templateDescription}
                      onChange={(e) => updateField("templateDescription", e.target.value)}
                      disabled={submitting}
                      placeholder="Deskripsi singkat produk..."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tier Pricing */}
            <div id="tpl-tiers" className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="mt-1 shrink-0">
                <TrendingDown size={20} className="text-blue-600" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold text-slate-800">
                      Skema Harga Tier <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500">
                      Harga tier besar harus lebih murah dari tier kecil.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTier}
                    disabled={submitting}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    <Plus size={14} />
                    Tambah Tier
                  </button>
                </div>

                {(errors.templateTiers || errors.templateTierInversion || errors.templateTierOverlap) && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                    <p className="text-xs text-amber-800">
                      {errors.templateTiers || errors.templateTierInversion || errors.templateTierOverlap}
                    </p>
                  </div>
                )}

                <div className="mt-3 space-y-3">
                  {draft.templateTiers.map((tier, index) => (
                    <div
                      key={tier.tierNumber}
                      className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center"
                    >
                      <span className="text-xs font-bold text-slate-700 sm:w-16">
                        Tier {tier.tierNumber}
                      </span>
                      <div className="flex flex-1 gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-500">Min Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={tier.minimumQuantity}
                            onChange={(e) => updateTier(index, "minimumQuantity", Number(e.target.value) || 1)}
                            disabled={submitting}
                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400 disabled:bg-white"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-500">Max Qty</label>
                          <input
                            type="number"
                            min={tier.minimumQuantity}
                            value={tier.maximumQuantity ?? ""}
                            onChange={(e) => updateTier(index, "maximumQuantity", e.target.value ? Number(e.target.value) : null)}
                            disabled={submitting || index === draft.templateTiers.length - 1}
                            placeholder={index === draft.templateTiers.length - 1 ? "∞" : ""}
                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400 disabled:bg-white disabled:text-slate-400"
                          />
                        </div>
                        <div className="w-28">
                          <label className="text-[10px] text-slate-500">Harga/Unit</label>
                          <input
                            type="number"
                            min={0}
                            value={tier.pricePerUnit || ""}
                            onChange={(e) => updateTier(index, "pricePerUnit", Number(e.target.value) || 0)}
                            disabled={submitting}
                            placeholder="Rp"
                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-400 disabled:bg-white"
                          />
                        </div>
                      </div>
                      {draft.templateTiers.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeTier(index)}
                          disabled={submitting}
                          className="self-end rounded p-1 text-red-400 transition hover:bg-red-50 hover:text-red-600 sm:self-center"
                          aria-label={`Hapus Tier ${tier.tierNumber}`}
                        >
                          <Minus size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pickup Location */}
            <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="mt-1 shrink-0">
                <MapPin size={20} className="text-orange-600" />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <label htmlFor="tpl-pickup-name" className="text-sm font-semibold text-slate-800">
                    Nama Lokasi <span className="text-red-500">*</span>
                  </label>
                  {errors.templatePickupName && (
                    <p className="mt-0.5 text-xs text-red-600">{errors.templatePickupName}</p>
                  )}
                  <input
                    id="tpl-pickup-name"
                    type="text"
                    required
                    value={draft.templatePickupName}
                    onChange={(e) => updateField("templatePickupName", e.target.value)}
                    disabled={submitting}
                    placeholder="Contoh: Gudang Wesup Bandung"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label htmlFor="tpl-pickup-address" className="text-sm font-semibold text-slate-800">
                    Alamat <span className="text-red-500">*</span>
                  </label>
                  {errors.templatePickupAddress && (
                    <p className="mt-0.5 text-xs text-red-600">{errors.templatePickupAddress}</p>
                  )}
                  <input
                    id="tpl-pickup-address"
                    type="text"
                    required
                    value={draft.templatePickupAddress}
                    onChange={(e) => updateField("templatePickupAddress", e.target.value)}
                    disabled={submitting}
                    placeholder="Alamat lengkap lokasi pengambilan..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    Koordinat Pin Peta <span className="text-red-500">*</span>
                  </label>
                  {errors.templateCoordinate && (
                    <p className="mt-0.5 text-xs text-red-600">{errors.templateCoordinate}</p>
                  )}
                  <div id="tpl-coordinate" className="relative mt-1 flex h-32 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <div className="absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PC9yZWN0Pgo8cGF0aCBkPSJNMCAwdjIwSDIwVjBIMHptMTkgMTlIMVYxSDE5djE4eiIgZmlsbD0iI2QxZDVkYiI+PC9wYXRoPgo8L3N2Zz4=')]" />
                    <button
                      type="button"
                      onClick={() => {
                        updateField("templatePickupLatitude", -6.921857);
                        updateField("templatePickupLongitude", 107.609729);
                        setErrors((e) => ({ ...e, templateCoordinate: undefined }));
                      }}
                      disabled={submitting}
                      className="relative rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-600 shadow-sm transition hover:bg-blue-50 disabled:opacity-50"
                    >
                      {draft.templatePickupLatitude !== null
                        ? `Koordinat: ${draft.templatePickupLatitude.toFixed(5)}, ${draft.templatePickupLongitude?.toFixed(5)}`
                        : "Klik untuk menandai lokasi (demo)"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Tinjauan */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold text-slate-900 outline-none"
            >
              Tinjauan Jadwal
            </h2>
            <p className="text-sm text-slate-500">
              Pastikan semua informasi sudah benar sebelum menyimpan jadwal.
            </p>

            {/* Status */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-blue-600" />
                <p className="text-sm font-medium text-blue-800">
                  Batch akan di-generate otomatis sesuai jadwal. Anda akan menerima
                  notifikasi H-1 untuk review sebelum tayang.
                </p>
              </div>
            </div>

            {/* Schedule Summary */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <Calendar size={16} className="text-blue-500" />
                Jadwal
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Nama Jadwal</dt>
                  <dd className="font-semibold text-slate-900">{draft.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Interval</dt>
                  <dd className="font-semibold text-slate-900">
                    Setiap {draft.intervalDays} hari
                  </dd>
                </div>
                {draft.daysOfWeek.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Hari Tayang</dt>
                    <dd className="font-semibold text-slate-900">
                      {draft.daysOfWeek
                        .sort((a, b) => a - b)
                        .map((d) => DAY_LABELS[d as DayOfWeek])
                        .join(", ")}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <span
                      className={
                        draft.isActive
                          ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                          : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
                      }
                    >
                      {draft.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </dd>
                </div>
              </dl>
            </section>

            {/* Product Summary */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <Package size={16} className="text-blue-500" />
                Template Produk
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Nama Produk</dt>
                  <dd className="font-semibold text-slate-900">{draft.templateTitle}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Kategori</dt>
                  <dd>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                      {draft.templateCategory}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Deskripsi</dt>
                  <dd className="max-w-xs text-right text-slate-900">
                    {draft.templateDescription}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Tier Summary */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <TrendingDown size={16} className="text-blue-500" />
                Skema Harga Tier
              </h3>
              <div className="mb-3 flex items-baseline gap-3">
                <span className="text-xl font-bold text-blue-700">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  }).format(lowestPrice)}
                </span>
                {lowestPrice < highestPrice && (
                  <span className="text-sm text-slate-400 line-through">
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    }).format(highestPrice)}
                  </span>
                )}
              </div>
              <ul className="space-y-1 text-sm">
                {draft.templateTiers.map((tier) => (
                  <li key={tier.tierNumber} className="flex justify-between">
                    <span className="text-slate-600">
                      Tier {tier.tierNumber}: {tier.minimumQuantity}–{tier.maximumQuantity ?? "+"} pcs
                    </span>
                    <strong className="text-slate-900">
                      {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      }).format(tier.pricePerUnit)}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>

            {/* Pickup Summary */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <MapPin size={16} className="text-orange-500" />
                Lokasi Pengambilan
              </h3>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-slate-900">{draft.templatePickupName}</p>
                <p className="text-slate-600">{draft.templatePickupAddress}</p>
                {draft.templatePickupLatitude !== null && draft.templatePickupLongitude !== null && (
                  <p className="font-mono text-xs text-slate-500">
                    Koordinat: {draft.templatePickupLatitude.toFixed(5)},{" "}
                    {draft.templatePickupLongitude.toFixed(5)}
                  </p>
                )}
              </div>
            </section>

            {/* Preview */}
            <RecurringBatchPreviewCard preview={preview} />
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kembali
            </button>
          ) : (
            <span aria-hidden="true" />
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={submitting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Simpan Draft
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-56"
            >
              {formState.submitPhase === "publishing" ? (
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : formState.submitPhase === "saved" ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : currentStep === 3 ? (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              )}
              {formState.submitPhase === "publishing"
                ? "Menyimpan..."
                : formState.submitPhase === "saved"
                  ? "Berhasil Disimpan!"
                  : currentStep === 3
                    ? "Simpan Jadwal"
                    : "Lanjut"}
            </button>
          </div>
        </div>

        {currentStep === 3 && (
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">
            Dengan menyimpan, Anda menyetujui jadwal ini akan menghasilkan batch
            otomatis sesuai interval yang diatur.
          </p>
        )}
      </form>

      {/* Success state */}
      {formState.submitPhase === "saved" && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
          <h3 className="mt-3 text-lg font-bold text-emerald-900">
            Jadwal berhasil disimpan!
          </h3>
          <p className="mt-1 text-sm text-emerald-700">
            Batch akan di-generate otomatis sesuai jadwal yang diatur.
          </p>
          <button
            type="button"
            onClick={() => router.push("/supplier/recurring")}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Lihat Semua Jadwal
          </button>
        </div>
      )}
    </>
  );
}

function focusFirstError(errors: FieldErrors) {
  const field = Object.keys(errors).find((key) => Boolean(errors[key as keyof FieldErrors]));
  if (!field) return;
  const targetId =
    field === "templateCoordinate"
      ? "tpl-coordinate"
      : field === "templateTierInversion" || field === "templateTierOverlap"
        ? "tpl-tiers"
        : field === "daysOfWeek"
          ? "recurring-name"
          : field.startsWith("templateTiers.")
            ? "tpl-tiers"
            : field === "intervalDays"
              ? "recurring-interval"
              : field;
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  if (target instanceof HTMLElement && target.matches("input, textarea, select")) target.focus();
}
