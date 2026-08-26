import type { MapCoordinate } from "@/lib/maps/leaflet-demo";
import {
  validateCoordinate,
  validateEmailFormat,
  validatePasswords,
  validatePhone,
  type FieldErrors,
} from "@/lib/supplier-registration/contracts";
import type { SupplierRegistrationReviewForm } from "@/lib/supplier-registration/review";

export type SupplierRegistrationStep = 1 | 2 | 3 | 4;

export interface SupplierRegistrationDraft {
  form: SupplierRegistrationReviewForm;
  coordinate: MapCoordinate | null;
  photo: Pick<File, "name" | "size" | "type"> | null;
}

export const SUPPLIER_REGISTRATION_STEPS = [
  { id: 1, label: "Akun", shortLabel: "Akun" },
  { id: 2, label: "Data Usaha", shortLabel: "Usaha" },
  { id: 3, label: "Lokasi & Foto", shortLabel: "Lokasi" },
  { id: 4, label: "Tinjauan", shortLabel: "Tinjauan" },
] as const satisfies ReadonlyArray<{
  id: SupplierRegistrationStep;
  label: string;
  shortLabel: string;
}>;

export function validateRegistrationStep(
  step: SupplierRegistrationStep,
  draft: SupplierRegistrationDraft,
): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 1) {
    if (!draft.form.fullName.trim()) errors.fullName = "Nama lengkap wajib diisi.";

    const emailError = validateEmailFormat(draft.form.email);
    if (emailError) errors.email = emailError;

    const phoneError = validatePhone(draft.form.phone);
    if (phoneError) errors.phone = phoneError;

    const passwordError = validatePasswords(
      draft.form.password,
      draft.form.confirmPassword,
    );
    if (passwordError === "Password minimal 8 karakter.") {
      errors.password = passwordError;
    } else if (passwordError) {
      errors.confirmPassword = passwordError;
    }

    if (draft.form.password !== draft.form.confirmPassword) {
      errors.confirmPassword = "Konfirmasi password tidak sama.";
    }
  }

  if (step === 2) {
    if (!draft.form.businessName.trim()) {
      errors.businessName = "Nama usaha wajib diisi.";
    }
    if (!draft.form.address.trim()) {
      errors.address = "Alamat usaha wajib diisi.";
    }
  }

  if (step === 3) {
    const coordinateError = validateCoordinate(draft.coordinate);
    if (coordinateError) errors.location = coordinateError;
    if (!draft.photo) errors.businessPhoto = "Foto tempat usaha wajib diunggah.";
  }

  return errors;
}

export function validateRegistrationDraft(
  draft: SupplierRegistrationDraft,
): FieldErrors {
  return {
    ...validateRegistrationStep(1, draft),
    ...validateRegistrationStep(2, draft),
    ...validateRegistrationStep(3, draft),
  };
}

export function getRegistrationStepForField(
  field: keyof FieldErrors,
): SupplierRegistrationStep {
  if (
    field === "fullName" ||
    field === "email" ||
    field === "phone" ||
    field === "password" ||
    field === "confirmPassword"
  ) {
    return 1;
  }

  if (field === "businessName" || field === "address") return 2;
  return 3;
}

export function getFirstErrorStep(
  errors: FieldErrors,
): SupplierRegistrationStep | null {
  const steps = Object.keys(errors)
    .filter((field): field is keyof FieldErrors => Boolean(errors[field as keyof FieldErrors]))
    .map((field) => getRegistrationStepForField(field));

  return steps.length > 0 ? Math.min(...steps) as SupplierRegistrationStep : null;
}
