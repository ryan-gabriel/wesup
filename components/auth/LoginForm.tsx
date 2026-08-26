"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/components/ui/GlobalToast";
import {
  getLoginRoleLabel,
  LOGIN_ROLES,
  type LoginErrorResponse,
  type LoginFieldErrors,
  type LoginRole,
  type LoginSuccessResponse,
} from "@/lib/auth/login-contract";

interface RoleOption {
  value: LoginRole;
  label: string;
  description: string;
  icon: LucideIcon;
}

const roleOptions: RoleOption[] = [
  {
    value: "admin",
    label: "Admin",
    description: "Kelola dan moderasi platform",
    icon: ShieldCheck,
  },
  {
    value: "umkm",
    label: "UMKM",
    description: "Belanja bahan baku bersama",
    icon: Store,
  },
  {
    value: "supplier",
    label: "Supplier",
    description: "Kelola penawaran dan pesanan",
    icon: Truck,
  },
];

export default function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<LoginRole>("umkm");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [globalError, setGlobalError] = useState<string>();

  function updateEmail(value: string) {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));
    setGlobalError(undefined);
  }

  function updatePassword(value: string) {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
    setGlobalError(undefined);
  }

  function updateRole(value: LoginRole) {
    setRole(value);
    setFieldErrors((current) => ({ ...current, role: undefined }));
    setGlobalError(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFieldErrors({});
    setGlobalError(undefined);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const body = (await response.json()) as Partial<
        LoginSuccessResponse & LoginErrorResponse
      >;

      if (!response.ok) {
        setFieldErrors(body.fieldErrors ?? {});
        setGlobalError(body.error ?? "Login belum dapat diproses. Coba lagi.");
        return;
      }

      const success = body as LoginSuccessResponse;
      toast(
        `Berhasil masuk sebagai ${getLoginRoleLabel(success.profile.role)}.`,
        "success",
      );
      router.replace(success.redirectTo);
      router.refresh();
    } catch {
      setGlobalError("Koneksi bermasalah. Periksa internet Anda lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = (field: keyof LoginFieldErrors) =>
    `mt-2 block w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
      fieldErrors[field]
        ? "border-red-400 bg-red-50/30"
        : "border-slate-200 bg-white"
    }`;

  function fieldError(field: keyof LoginFieldErrors) {
    return fieldErrors[field] ? (
      <p id={`${field}-error`} className="mt-1.5 text-xs font-medium text-red-600" role="alert">
        {fieldErrors[field]}
      </p>
    ) : null;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-7">
      {globalError ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700"
          role="alert"
        >
          {globalError}
        </div>
      ) : null}

      <fieldset disabled={submitting} className="space-y-3">
        <legend className="text-sm font-semibold text-slate-800">
          Login sebagai
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {roleOptions.map((option) => {
            const Icon = option.icon;
            const selected = role === option.value;
            return (
              <label
                key={option.value}
                className={`relative flex cursor-pointer flex-col rounded-2xl border p-4 transition focus-within:ring-2 focus-within:ring-blue-200 ${
                  selected
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={selected}
                  onChange={() => updateRole(option.value)}
                  className="sr-only"
                  aria-describedby="role-description"
                />
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="mt-3 text-sm font-bold">{option.label}</span>
                <span className="mt-1 text-xs leading-5 text-slate-500">
                  {option.description}
                </span>
              </label>
            );
          })}
        </div>
        <p id="role-description" className="text-xs text-slate-500">
          Pilih sesuai role akun yang sudah terdaftar di Wesup.
        </p>
        {fieldError("role")}
      </fieldset>

      <div>
        <label htmlFor="login-email" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Mail className="h-4 w-4 text-blue-600" aria-hidden="true" />
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => updateEmail(event.target.value)}
          className={inputClass("email")}
          placeholder="alamat@email.com"
          autoComplete="email"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          required
        />
        {fieldError("email")}
      </div>

      <div>
        <label htmlFor="login-password" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <LockKeyhole className="h-4 w-4 text-blue-600" aria-hidden="true" />
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => updatePassword(event.target.value)}
            className={`${inputClass("password")} pr-12`}
            placeholder="Masukkan password Anda"
            autoComplete="current-password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute inset-y-0 right-0 mt-2 flex items-center px-3 text-slate-400 transition hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
        {fieldError("password")}
      </div>

      <button
        type="submit"
        disabled={submitting || !LOGIN_ROLES.includes(role)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        )}
        {submitting ? "Sedang masuk…" : "Masuk ke akun"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Belum menjadi mitra pemasok?{" "}
        <a href="/supplier/register" className="font-semibold text-blue-700 underline-offset-4 hover:underline">
          Daftar sebagai Supplier
        </a>
      </p>
    </form>
  );
}
