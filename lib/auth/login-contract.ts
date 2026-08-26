import type { AccountStatus, UserRole, VerificationStatus } from "@/types/database";

export const LOGIN_ROLES = ["admin", "umkm", "supplier"] as const;
export type LoginRole = (typeof LOGIN_ROLES)[number];

export interface LoginRequest {
  email: string;
  password: string;
  role: LoginRole;
}

export interface LoginFieldErrors {
  email?: string;
  password?: string;
  role?: string;
}

export interface LoginProfile {
  role: UserRole;
  status: AccountStatus;
  fullName: string;
}

export interface LoginSuccessResponse {
  user: { email: string };
  profile: LoginProfile;
  redirectTo: string;
}

export type LoginErrorCode =
  | "invalid_credentials"
  | "inactive_account"
  | "role_mismatch"
  | "supplier_pending"
  | "supplier_rejected"
  | "profile_unavailable";

export interface LoginErrorResponse {
  error: string;
  code?: LoginErrorCode;
  fieldErrors?: LoginFieldErrors;
}

export const LOGIN_REDIRECT_BY_ROLE: Record<LoginRole, string> = {
  admin: "/",
  umkm: "/",
  supplier: "/",
};

export type ParseLoginPayloadResult =
  | { ok: true; value: LoginRequest }
  | { ok: false; fieldErrors: LoginFieldErrors };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_LABELS: Record<LoginRole, string> = {
  admin: "Admin",
  umkm: "UMKM",
  supplier: "Supplier",
};

export function parseLoginPayload(input: unknown): ParseLoginPayloadResult {
  const body =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string" ? body.role : "";
  const fieldErrors: LoginFieldErrors = {};

  if (!EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "Masukkan alamat email yang valid.";
  }
  if (!password) {
    fieldErrors.password = "Password wajib diisi.";
  }
  if (!LOGIN_ROLES.includes(role as LoginRole)) {
    fieldErrors.role = "Pilih jenis akun untuk login.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: { email, password, role: role as LoginRole },
  };
}

export function getAccountStatusMessage(status: AccountStatus): string {
  switch (status) {
    case "suspended_temporary":
      return "Akun Anda sedang ditangguhkan sementara.";
    case "suspended_permanent":
      return "Akun Anda ditangguhkan permanen. Hubungi Admin Wesup.";
    case "banned":
      return "Akun Anda diblokir. Hubungi Admin Wesup.";
    case "active":
      return "Akun Anda belum dapat digunakan.";
  }
}

export function getRoleMismatchMessage(
  role: LoginRole,
  verificationStatus?: VerificationStatus | null,
): string {
  if (role === "supplier" && verificationStatus === "pending") {
    return "Pendaftaran pemasok Anda masih menunggu verifikasi Admin.";
  }

  if (role === "supplier" && verificationStatus === "rejected") {
    return "Pendaftaran pemasok Anda belum disetujui. Hubungi Admin Wesup.";
  }

  return `Akun ini tidak terdaftar sebagai ${ROLE_LABELS[role]}.`;
}

export function getLoginRoleLabel(role: LoginRole): string {
  return ROLE_LABELS[role];
}
