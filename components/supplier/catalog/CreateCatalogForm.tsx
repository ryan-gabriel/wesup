"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Save } from "lucide-react";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";
import {
  INITIAL_CATALOG_DRAFT,
  type CatalogDraft,
  type CatalogDraftStep,
  type CatalogTierDraft,
  type FieldErrors,
} from "@/lib/supplier-catalog/types";
import type { CatalogMutationAction } from "@/lib/supplier-catalog/api-repository";
import { supplierCatalogApiRepository } from "@/lib/supplier-catalog/api-repository";
import CatalogStepper from "@/components/supplier/catalog/CatalogStepper";
import ProductDetailStep from "@/components/supplier/catalog/steps/ProductDetailStep";
import TierPricingStep from "@/components/supplier/catalog/steps/TierPricingStep";
import TimelineStep from "@/components/supplier/catalog/steps/TimelineStep";
import PickupLocationStep from "@/components/supplier/catalog/steps/PickupLocationStep";
import CatalogReviewStep from "@/components/supplier/catalog/steps/CatalogReviewStep";
import CatalogSuccessDialog, { successKindFor } from "@/components/supplier/catalog/CatalogSuccessDialog";

type SubmitPhase = "idle" | "saving" | "saved";

export interface CreateCatalogFormProps {
  initialDraft?: CatalogDraft;
  batchId?: string;
  submitAction?: CatalogMutationAction;
  locationLocked?: boolean;
  tiersLocked?: boolean;
  submitLabel?: string;
  productPhotoRequired?: boolean;
}

function validateStep(step: CatalogDraftStep, draft: CatalogDraft, productPhotoRequired = true): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 1) {
    if (!draft.title.trim()) errors.title = "Nama produk wajib diisi.";
    if (!draft.category) errors.category = "Pilih kategori produk.";
    if (draft.targetQuantity <= 0 || !Number.isInteger(draft.targetQuantity)) errors.targetQuantity = "Target kelompok harus berupa bilangan bulat positif.";
    if (!draft.description.trim()) errors.description = "Deskripsi produk wajib diisi.";
    if (productPhotoRequired && !draft.productPhoto && !draft.productPhotoUrl) errors.productPhoto = "Unggah foto produk.";
  }

  if (step === 2) {
    if (draft.tiers.length < 2) errors.tiers = "Minimal 2 tier harga.";
    for (let i = 0; i < draft.tiers.length; i++) {
      const tier = draft.tiers[i];
      if (tier.minimumQuantity <= 0 || !Number.isInteger(tier.minimumQuantity)) errors[`tiers.${i}.minimumQuantity` as keyof FieldErrors] = `Kuantitas minimum Tier ${tier.tierNumber} tidak valid.`;
      if (tier.pricePerUnit <= 0) errors[`tiers.${i}.pricePerUnit` as keyof FieldErrors] = `Harga Tier ${tier.tierNumber} wajib diisi.`;
      if (i < draft.tiers.length - 1 && tier.maximumQuantity === null) errors[`tiers.${i}.maximumQuantity` as keyof FieldErrors] = `Kuantitas maksimum Tier ${tier.tierNumber} wajib diisi.`;
      if (tier.maximumQuantity !== null && tier.maximumQuantity < tier.minimumQuantity) errors[`tiers.${i}.maximumQuantity` as keyof FieldErrors] = `Rentang Tier ${tier.tierNumber} tidak valid.`;
    }
    for (let i = 1; i < draft.tiers.length; i++) {
      if (draft.tiers[i].pricePerUnit >= draft.tiers[i - 1].pricePerUnit) {
        errors.tierInversion = "Harga tier harus menurun seiring kuantitas naik.";
        break;
      }
    }
    for (let i = 1; i < draft.tiers.length; i++) {
      const prevMax = draft.tiers[i - 1].maximumQuantity ?? Infinity;
      if (draft.tiers[i].minimumQuantity <= prevMax) {
        errors.tierOverlap = "Rentang kuota antar tier tidak boleh overlap.";
        break;
      }
    }
  }

  if (step === 3) {
    const fields = ["registrationOpensAt", "registrationClosesAt", "paymentOpensAt", "paymentClosesAt", "estimatedReadyAt"] as const;
    for (const field of fields) if (!draft[field]) errors[field] = "Waktu ini wajib diisi.";
    const times = fields.map((field) => new Date(draft[field]).getTime());
    if (times.every((time) => !Number.isNaN(time))) {
      for (let i = 1; i < times.length; i++) {
        if (times[i] <= times[i - 1]) {
          errors.timelineOrder = "Urutan waktu tidak logis. Pastikan setiap waktu lebih besar dari sebelumnya.";
          break;
        }
      }
    }
  }

  if (step === 4) {
    if (!draft.pickupName.trim()) errors.pickupName = "Nama lokasi wajib diisi.";
    if (!draft.pickupAddress.trim()) errors.pickupAddress = "Alamat wajib diisi.";
    if (draft.pickupLatitude === null || draft.pickupLongitude === null) errors.pickupCoordinate = "Pin peta wajib dipilih. Klik pada peta untuk menandai lokasi.";
  }

  return errors;
}

function validateAll(draft: CatalogDraft, productPhotoRequired: boolean): FieldErrors {
  return ([1, 2, 3, 4] as const).reduce<FieldErrors>(
    (all, step) => ({ ...all, ...validateStep(step, draft, productPhotoRequired) }),
    {},
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : "Katalog belum dapat disimpan. Coba lagi.";
}

export default function CreateCatalogForm({
  initialDraft,
  batchId,
  submitAction = "publish",
  locationLocked = false,
  tiersLocked = false,
  submitLabel,
  productPhotoRequired = true,
}: CreateCatalogFormProps = {}) {
  const router = useRouter();
  const [draft, setDraft] = useState<CatalogDraft>(initialDraft ?? INITIAL_CATALOG_DRAFT);
  const [currentStep, setCurrentStep] = useState<CatalogDraftStep>(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string>();
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [activeAction, setActiveAction] = useState<CatalogMutationAction>(submitAction);
  const [successfulAction, setSuccessfulAction] = useState<CatalogMutationAction | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<CatalogDraftStep>(1);
  const pendingErrorFocusRef = useRef<FieldErrors | null>(null);
  const submitControllerRef = useRef<AbortController | null>(null);

  const navigateToCatalog = useCallback(() => router.push("/supplier/catalog"), [router]);

  const submitting = submitPhase !== "idle";

  useEffect(() => {
    if (previousStepRef.current === currentStep) return;
    previousStepRef.current = currentStep;
    const errorToFocus = pendingErrorFocusRef.current;
    pendingErrorFocusRef.current = null;
    window.setTimeout(() => {
      if (errorToFocus) {
        focusFirstError(errorToFocus);
        return;
      }
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [currentStep]);

  useEffect(() => () => submitControllerRef.current?.abort(), []);

  const updateField = useCallback((field: keyof CatalogDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setGlobalError(undefined);
  }, []);

  const updateTiers = useCallback((tiers: CatalogTierDraft[]) => {
    setDraft((current) => ({ ...current, tiers }));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) if (key.startsWith("tiers.") || key === "tierOverlap" || key === "tierInversion") delete next[key as keyof FieldErrors];
      return next;
    });
    setGlobalError(undefined);
  }, []);

  const goBack = useCallback(() => {
    if (submitting || currentStep === 1) return;
    setGlobalError(undefined);
    setCurrentStep((step) => (step - 1) as CatalogDraftStep);
  }, [currentStep, submitting]);

  const goNext = useCallback(() => {
    if (currentStep === 5 || submitting) return false;
    const stepErrors = validateStep(currentStep, draft, productPhotoRequired);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((current) => ({ ...current, ...stepErrors }));
      setGlobalError(undefined);
      focusFirstError(stepErrors);
      return false;
    }
    setErrors({});
    setGlobalError(undefined);
    setCurrentStep((step) => (step + 1) as CatalogDraftStep);
    return true;
  }, [currentStep, draft, productPhotoRequired, submitting]);

  const persist = useCallback(async (action: CatalogMutationAction) => {
    if (submitting) return;
    const requiredPhoto = action === "publish" && productPhotoRequired;
    const allErrors = validateAll(draft, requiredPhoto);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setGlobalError("Periksa kembali data yang wajib diisi sebelum menyimpan.");
      focusFirstError(allErrors);
      return;
    }

    submitControllerRef.current?.abort();
    const controller = new AbortController();
    submitControllerRef.current = controller;
    setGlobalError(undefined);
    setActiveAction(action);
    setSuccessfulAction(null);
    setSubmitPhase("saving");
    try {
      if (batchId) {
        await supplierCatalogApiRepository.update(batchId, draft, action, { signal: controller.signal });
      } else {
        await supplierCatalogApiRepository.create(draft, action, { signal: controller.signal });
      }
      if (!controller.signal.aborted) {
        setSuccessfulAction(action);
        setSubmitPhase("saved");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setSubmitPhase("idle");
        setGlobalError(errorMessage(error));
      }
    } finally {
      if (submitControllerRef.current === controller) submitControllerRef.current = null;
    }
  }, [batchId, draft, productPhotoRequired, submitting]);

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    if (currentStep < 5) {
      goNext();
      return;
    }
    void persist(submitAction);
  }, [currentStep, goNext, persist, submitAction]);

  const handleSaveDraft = useCallback(() => {
    void persist("draft");
  }, [persist]);

  return (
    <>
      <CatalogStepper currentStep={currentStep} />
      <form onSubmit={handleSubmit} noValidate className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-8 lg:p-10">
        {globalError && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{globalError}</div>}

        {currentStep === 1 && (
          <ProductDetailStep
            draft={draft}
            errors={errors}
            disabled={submitting}
            headingRef={headingRef}
            onFieldChange={(field, value) => updateField(field, value)}
            onTargetQuantityChange={(value) => {
              setDraft((current) => ({ ...current, targetQuantity: value }));
              setErrors((current) => ({ ...current, targetQuantity: undefined }));
              setGlobalError(undefined);
            }}
            onPhotoChange={(file) => {
              setDraft((current) => ({ ...current, productPhoto: file, productPhotoUrl: file ? null : current.productPhotoUrl }));
              setErrors((current) => ({ ...current, productPhoto: undefined }));
              setGlobalError(undefined);
            }}
          />
        )}
        {currentStep === 2 && <TierPricingStep draft={draft} errors={errors} disabled={submitting} locked={tiersLocked} headingRef={headingRef} onTiersChange={updateTiers} />}
        {currentStep === 3 && <TimelineStep draft={draft} errors={errors} disabled={submitting} headingRef={headingRef} onFieldChange={(field, value) => updateField(field, value)} />}
        {currentStep === 4 && (
          <PickupLocationStep
            draft={draft}
            errors={errors}
            disabled={submitting}
            locationLocked={locationLocked}
            headingRef={headingRef}
            onFieldChange={(field, value) => updateField(field, value)}
            onCoordinateChange={(coord: MapCoordinate) => {
              if (locationLocked) return;
              setDraft((current) => ({ ...current, pickupLatitude: coord.lat, pickupLongitude: coord.lng }));
              setErrors((current) => ({ ...current, pickupCoordinate: undefined }));
            }}
          />
        )}
        {currentStep === 5 && (
          <div className="space-y-6">
            <CatalogReviewStep draft={draft} headingRef={headingRef} />
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-slate-200" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Postingan berulang</h3>
                  <p className="mt-1 text-xs text-slate-500">Fitur lifecycle recurring segera tersedia. Pengaturan ini dinonaktifkan agar tidak memberi status sukses palsu.</p>
                </div>
                <span className="ml-auto rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Segera tersedia</span>
              </div>
            </section>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          {currentStep > 1 ? (
            <button type="button" onClick={goBack} disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali
            </button>
          ) : <span aria-hidden="true" />}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            {currentStep === 5 && (
              <button type="button" onClick={handleSaveDraft} disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-4 w-4" aria-hidden="true" /> Simpan Draft
              </button>
            )}
            <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-56">
              {submitPhase === "saving" ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : submitPhase === "saved" ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : currentStep === 5 ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <ArrowRight className="h-5 w-5" aria-hidden="true" />}
              {submitPhase === "saving" ? (activeAction === "publish" ? "Menerbitkan..." : "Menyimpan...") : submitPhase === "saved" ? "Berhasil Disimpan!" : currentStep === 5 ? (submitLabel ?? (submitAction === "publish" ? "Terbitkan Penawaran" : "Simpan Perubahan")) : "Lanjut"}
            </button>
          </div>
        </div>
        {currentStep === 5 && <p className="mt-4 text-center text-xs leading-5 text-slate-500">Dengan menerbitkan, Anda menyetujui bahwa data penawaran akan tayang di marketplace Wesup. Draft tetap tersimpan privat sampai diterbitkan.</p>}
      </form>

      <CatalogSuccessDialog
        open={submitPhase === "saved" && successfulAction !== null}
        kind={successfulAction ? successKindFor(successfulAction, batchId) : "draft"}
        onClose={navigateToCatalog}
      />
    </>
  );
}

function focusFirstError(errors: FieldErrors) {
  const field = Object.keys(errors).find((key) => Boolean(errors[key as keyof FieldErrors]));
  if (!field) return;
  const targetId = field === "pickupCoordinate" ? "pickup-map" : field.startsWith("tiers.") ? field.replace("tiers.", "tier-") : field === "targetQuantity" ? "catalog-target-quantity" : field;
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  if (target instanceof HTMLElement && target.matches("input, textarea, select")) target.focus();
}