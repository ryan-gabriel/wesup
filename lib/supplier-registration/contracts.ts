import { isValidCoordinate, type MapCoordinate } from "@/lib/maps/leaflet-demo";
import { MAX_INPUT_BYTES } from "@/lib/image-compression/validation";

export interface SupplierRegistrationFields {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  businessName: string;
  address: string;
  latitude: number;
  longitude: number;
  businessPhoto: File;
}

export type FieldErrors = Partial<
  Record<
    | "fullName"
    | "email"
    | "phone"
    | "password"
    | "confirmPassword"
    | "businessName"
    | "address"
    | "location"
    | "businessPhoto",
    string
  >
>;

export type EmailAvailabilityResponse =
  | { available: true; message: "Email tersedia." }
  | { available: false; message: "Email sudah digunakan." };

export type RegistrationSuccessResponse = {
  ok: true;
  verificationStatus: "pending";
  requiresEmailConfirmation: boolean;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^(?:0|62)[0-9]{8,13}$/;
export const ACCEPTED_INPUT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmailFormat(email: string): string | undefined {
  if (!email.trim()) return "Email wajib diisi.";
  if (!EMAIL_RE.test(normalizeEmail(email))) return "Format email tidak valid.";
  return undefined;
}

export function validatePasswords(
  password: string,
  confirmPassword: string,
): string | undefined {
  if (password.length < 8) return "Password minimal 8 karakter.";
  if (password !== confirmPassword) return "Konfirmasi password tidak sama.";
  return undefined;
}

export function validatePhone(phone: string): string | undefined {
  const normalized = phone.replace(/[\s-]/g, "");
  if (!normalized) return "Nomor WhatsApp wajib diisi.";
  if (!PHONE_RE.test(normalized)) {
    return "Nomor WhatsApp tidak valid.";
  }
  return undefined;
}

export function validateCoordinate(
  coordinate: MapCoordinate | null | undefined,
): string | undefined {
  if (!coordinate || !isValidCoordinate(coordinate)) {
    return "Titik lokasi usaha wajib dipilih pada peta.";
  }
  return undefined;
}

export function validateWebPFileMetadata(file: Pick<File, "size" | "type">): string | undefined {
  if (file.size > MAX_INPUT_BYTES) return "Ukuran foto maksimal 10 MB.";
  if (file.type !== "image/webp") return "Foto harus berformat WebP.";
  return undefined;
}

export async function isWebPFile(file: File): Promise<boolean> {
  if (validateWebPFileMetadata(file)) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  return text(0, 4) === "RIFF" && text(8, 4) === "WEBP";
}

export async function validateBusinessPhoto(file: File): Promise<string | undefined> {
  const metadataError = validateWebPFileMetadata(file);
  if (metadataError) return metadataError;
  if (!(await isWebPFile(file))) return "Isi berkas foto WebP tidak valid.";
  return undefined;
}

export function validateRawImageInput(
  file: Pick<File, "size" | "type">,
): string | undefined {
  if (file.size > MAX_INPUT_BYTES) return "Ukuran foto maksimal 10 MB.";
  if (!(ACCEPTED_INPUT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Pilih foto JPEG, PNG, atau WebP.";
  }
  return undefined;
}

export function parseNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function parseSupplierRegistrationFormData(
  formData: FormData,
): Promise<{ fields?: SupplierRegistrationFields; errors: FieldErrors }> {
  const fullName = textValue(formData.get("fullName"));
  const email = normalizeEmail(textValue(formData.get("email")));
  const phone = textValue(formData.get("phone")).replace(/[\s-]/g, "");
  const password = textValue(formData.get("password"));
  const confirmPassword = textValue(formData.get("confirmPassword"));
  const businessName = textValue(formData.get("businessName"));
  const address = textValue(formData.get("address"));
  const latitude = parseNumber(formData.get("latitude"));
  const longitude = parseNumber(formData.get("longitude"));
  const photo = formData.get("businessPhoto");
  const errors: FieldErrors = {};

  if (!fullName) errors.fullName = "Nama lengkap wajib diisi.";
  const emailError = validateEmailFormat(email);
  if (emailError) errors.email = emailError;
  const phoneError = validatePhone(phone);
  if (phoneError) errors.phone = phoneError;
  if (password.length < 8) {
    errors.password = "Password minimal 8 karakter.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Konfirmasi password tidak sama.";
  }
  if (!businessName) errors.businessName = "Nama usaha wajib diisi.";
  if (!address) errors.address = "Alamat usaha wajib diisi.";
  if (latitude === null || longitude === null || !isValidCoordinate({ lat: latitude ?? 0, lng: longitude ?? 0 })) {
    errors.location = "Titik lokasi usaha wajib dipilih pada peta.";
  }
  if (!(photo instanceof File)) {
    errors.businessPhoto = "Foto tempat usaha wajib diunggah.";
  } else {
    const photoError = await validateBusinessPhoto(photo);
    if (photoError) errors.businessPhoto = photoError;
  }

  if (Object.keys(errors).length > 0) return { errors };
  return {
    errors: {},
    fields: {
      fullName,
      email,
      phone,
      password,
      businessName,
      address,
      latitude: latitude as number,
      longitude: longitude as number,
      businessPhoto: photo as File,
    },
  };
}

function textValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}
