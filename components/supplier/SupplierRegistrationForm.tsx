"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";
import {
  normalizeEmail,
  type FieldErrors,
  type RegistrationSuccessResponse,
} from "@/lib/supplier-registration/contracts";
import {
  getFirstErrorStep,
  getRegistrationStepForField,
  validateRegistrationDraft,
  validateRegistrationStep,
  type SupplierRegistrationDraft,
  type SupplierRegistrationStep,
} from "@/lib/supplier-registration/steps";
import {
  buildSupplierRegistrationReview,
  type SupplierRegistrationReviewForm,
} from "@/lib/supplier-registration/review";
import RegistrationSuccessDialog from "@/components/supplier/RegistrationSuccessDialog";
import SupplierRegistrationStepper from "@/components/supplier/SupplierRegistrationStepper";
import AccountStep from "@/components/supplier/steps/AccountStep";
import BusinessStep from "@/components/supplier/steps/BusinessStep";
import LocationPhotoStep from "@/components/supplier/steps/LocationPhotoStep";
import RegistrationReviewStep from "@/components/supplier/steps/RegistrationReviewStep";

const initialForm: SupplierRegistrationReviewForm = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  businessName: "",
  address: "",
};

type RequestStatus = "idle" | "submitting";

export default function SupplierRegistrationForm() {
  const [form, setForm] = useState<SupplierRegistrationReviewForm>(initialForm);
  const [coordinate, setCoordinate] = useState<MapCoordinate | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState<SupplierRegistrationStep>(1);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string>();
  const [success, setSuccess] = useState<RegistrationSuccessResponse | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef<SupplierRegistrationStep>(1);
  const pendingErrorFocusRef = useRef<FieldErrors | null>(null);

  const submitting = requestStatus === "submitting";
  const draft = useMemo<SupplierRegistrationDraft>(
    () => ({ form, coordinate, photo }),
    [form, coordinate, photo],
  );
  const review = useMemo(
    () => (coordinate && photo ? buildSupplierRegistrationReview({ form, coordinate, photo }) : null),
    [form, coordinate, photo],
  );

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
      focusHeading(headingRef.current);
    }, 0);
  }, [currentStep]);

  const closeSuccess = useCallback(() => setSuccess(null), []);

  const updateField = useCallback(
    (field: keyof SupplierRegistrationReviewForm, value: string) => {
      setForm((current) => ({ ...current, [field]: value }));
      setFieldErrors((current) => ({
        ...current,
        [field]: undefined,
        ...(field === "password" ? { confirmPassword: undefined } : {}),
      }));
      setGlobalError(undefined);
    },
    [],
  );

  const goBack = useCallback(() => {
    if (submitting || currentStep === 1) return;
    setGlobalError(undefined);
    setCurrentStep((step) => (step - 1) as SupplierRegistrationStep);
  }, [currentStep, submitting]);

  const goToStep = useCallback(
    (step: Exclude<SupplierRegistrationStep, 4>) => {
      if (submitting) return;
      setGlobalError(undefined);
      setCurrentStep(step);
    },
    [submitting],
  );

  const goNext = useCallback(() => {
    if (currentStep === 4 || submitting) return false;
    const errors = validateRegistrationStep(currentStep, draft);
    if (Object.keys(errors).length > 0) {
      setFieldErrors((current) => ({ ...current, ...errors }));
      setGlobalError(undefined);
      focusFirstError(errors);
      return false;
    }

    setFieldErrors((current) => withoutStepErrors(current, currentStep));
    setGlobalError(undefined);
    setCurrentStep((step) => (step + 1) as SupplierRegistrationStep);
    return true;
  }, [currentStep, draft, submitting]);

  const submitRegistration = useCallback(async () => {
    if (submitting || currentStep !== 4 || !coordinate || !photo) return;

    const validationErrors = validateRegistrationDraft(draft);
    if (Object.keys(validationErrors).length > 0) {
      const errorStep = getFirstErrorStep(validationErrors);
      setFieldErrors(validationErrors);
      setGlobalError(undefined);
      if (errorStep && errorStep !== currentStep) {
        pendingErrorFocusRef.current = validationErrors;
        setCurrentStep(errorStep);
      } else {
        focusFirstError(validationErrors);
      }
      return;
    }

    setRequestStatus("submitting");
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
      const response = await fetch("/api/suppliers/register", {
        method: "POST",
        body: payload,
      });
      const body = (await response.json()) as Partial<RegistrationSuccessResponse> & {
        error?: string;
        fieldErrors?: FieldErrors;
      };

      if (!response.ok) {
        const responseErrors = body.fieldErrors ?? {};
        setFieldErrors(responseErrors);
        setGlobalError(body.error ?? "Pendaftaran belum dapat diproses. Coba lagi.");
        const errorStep = getFirstErrorStep(responseErrors);
        if (errorStep) {
          if (errorStep !== currentStep) {
            pendingErrorFocusRef.current = responseErrors;
            setCurrentStep(errorStep);
          } else {
            window.setTimeout(() => focusFirstError(responseErrors), 0);
          }
        }
        return;
      }

      setSuccess(body as RegistrationSuccessResponse);
      setForm(initialForm);
      setCoordinate(null);
      setPhoto(null);
      setFieldErrors({});
      setGlobalError(undefined);
      setCurrentStep(1);
    } catch {
      setGlobalError("Koneksi bermasalah. Periksa internet Anda lalu coba lagi.");
    } finally {
      setRequestStatus("idle");
    }
  }, [coordinate, currentStep, draft, form, photo, submitting]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStep < 4) {
      goNext();
      return;
    }
    void submitRegistration();
  }

  return (
    <>
      <SupplierRegistrationStepper currentStep={currentStep} />

      <form onSubmit={handleSubmit} noValidate className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-8 lg:p-10">
        {globalError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {globalError}
          </div>
        )}

        {currentStep === 1 && (
          <AccountStep
            value={form}
            errors={fieldErrors}
            disabled={submitting}
            headingRef={headingRef}
            onFieldChange={updateField}
          />
        )}
        {currentStep === 2 && (
          <BusinessStep
            value={form}
            errors={fieldErrors}
            disabled={submitting}
            headingRef={headingRef}
            onFieldChange={updateField}
          />
        )}
        {currentStep === 3 && (
          <LocationPhotoStep
            coordinate={coordinate}
            photo={photo}
            errors={fieldErrors}
            disabled={submitting}
            headingRef={headingRef}
            onCoordinateChange={(nextCoordinate) => {
              setCoordinate(nextCoordinate);
              setFieldErrors((current) => ({ ...current, location: undefined }));
              setGlobalError(undefined);
            }}
            onPhotoChange={(nextPhoto) => {
              setPhoto(nextPhoto);
              setFieldErrors((current) => ({ ...current, businessPhoto: undefined }));
              setGlobalError(undefined);
            }}
          />
        )}
        {currentStep === 4 && review && photo && (
          <RegistrationReviewStep
            review={review}
            photo={photo}
            headingRef={headingRef}
            onEdit={goToStep}
          />
        )}

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

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-56"
          >
            {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : currentStep === 4 ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <ArrowRight className="h-5 w-5" aria-hidden="true" />}
            {submitting
              ? "Mengirim pendaftaran…"
              : currentStep === 1
                ? "Lanjut ke Data Usaha"
                : currentStep === 2
                  ? "Lanjut ke Lokasi & Foto"
                  : currentStep === 3
                    ? "Tinjau Pendaftaran"
                    : "Ya, kirim pendaftaran"}
          </button>
        </div>

        {currentStep === 4 && (
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">Dengan mengirim pendaftaran, Anda menyetujui Syarat & Ketentuan serta Kebijakan Privasi Wesup.</p>
        )}
      </form>

      <RegistrationSuccessDialog
        open={success !== null}
        requiresEmailConfirmation={success?.requiresEmailConfirmation ?? false}
        onClose={closeSuccess}
      />
    </>
  );
}

function withoutStepErrors(errors: FieldErrors, step: SupplierRegistrationStep): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([field, message]) => {
      if (!message) return false;
      return getRegistrationStepForField(field as keyof FieldErrors) !== step;
    }),
  ) as FieldErrors;
}

function focusFirstError(errors: FieldErrors) {
  const field = Object.keys(errors).find((key) => Boolean(errors[key as keyof FieldErrors]));
  if (!field) return;

  const targetId = field === "location" ? "supplier-location" : field === "businessPhoto" ? "business-photo" : field;
  const target = document.getElementById(targetId);
  if (!target) return;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  if (target instanceof HTMLElement && target.matches("input, textarea, button, select")) target.focus();
}

function focusHeading(heading: HTMLHeadingElement | null) {
  if (!heading) return;
  heading.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  heading.focus({ preventScroll: true });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
