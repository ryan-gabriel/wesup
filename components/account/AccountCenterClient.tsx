"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  LogOut,
  Shield,
  User,
  Wallet,
} from "lucide-react";
import {
  ACCOUNT_PROFILE_MOCK,
  SUPPLIER_ACCOUNT_LINKS,
  SUPPLIER_PROFILE_MOCK,
  ROLE_META,
  STATUS_META,
  type AccountProfile,
} from "@/lib/account/mock-data";

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

export default function AccountCenterClient() {
  const [activeProfile, setActiveProfile] = useState<AccountProfile>(ACCOUNT_PROFILE_MOCK);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  const roleMeta = ROLE_META[activeProfile.role];
  const statusMeta = STATUS_META[activeProfile.status];

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      // Silently redirect even on network error — the session may still be invalid.
      router.push("/");
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo role toggle */}
      <section className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-3 text-center text-xs text-indigo-700">
        <p className="font-semibold">Demo mode</p>
        <p className="mt-1 text-indigo-600">
          Profil ditampilkan dari mock data. Ganti peran untuk melihat tautan akun berbeda.
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveProfile(ACCOUNT_PROFILE_MOCK)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeProfile.role === "umkm"
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            UMKM (Rina)
          </button>
          <button
            type="button"
            onClick={() => setActiveProfile(SUPPLIER_PROFILE_MOCK)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeProfile.role === "supplier"
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Supplier (PT Agri)
          </button>
        </div>
      </section>

      {/* Profile card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">
            {activeProfile.initials}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-slate-900">{activeProfile.fullName}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{activeProfile.email}</p>
            {activeProfile.phone ? (
              <p className="mt-0.5 text-sm text-slate-500">{activeProfile.phone}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleMeta.className}`}>
                <User className="h-3 w-3" aria-hidden="true" /> {roleMeta.label}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
              {activeProfile.role === "supplier" && activeProfile.verificationStatus ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  activeProfile.verificationStatus === "approved"
                    ? "bg-emerald-100 text-emerald-700"
                    : activeProfile.verificationStatus === "pending"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  <Shield className="h-3 w-3" aria-hidden="true" />
                  {activeProfile.verificationStatus === "approved"
                    ? "Terverifikasi"
                    : activeProfile.verificationStatus === "pending"
                    ? "Menunggu Verifikasi"
                    : "Verifikasi Ditolak"}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Bergabung: {dates.format(new Date(activeProfile.createdAt))}
        </p>
      </section>

      {/* Supplier-specific links */}
      {activeProfile.role === "supplier" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Wallet className="h-4 w-4 text-violet-600" aria-hidden="true" />
            Pengaturan Supplier
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Pengaturan rekening, escrow, dan laporan untuk akun supplier Anda.
          </p>
          <div className="mt-4 space-y-2">
            {SUPPLIER_ACCOUNT_LINKS.map(({ label, description, href }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center justify-between rounded-lg border border-slate-100 p-3 transition hover:border-violet-200 hover:bg-violet-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-700">{label}</p>
                  <p className="text-xs text-slate-500">{description}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-violet-500" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Settings / Security section */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Shield className="h-4 w-4 text-blue-600" aria-hidden="true" />
          Keamanan & Pengaturan
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Kelola password dan pengaturan akun Anda. Fitur ini akan tersedia sepenuhnya saat data dihubungkan ke database.
        </p>
        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-slate-100 p-3">
            <p className="text-sm font-semibold text-slate-900">Ganti Password</p>
            <p className="text-xs text-slate-500">Menggunakan alur reset password yang sudah ada di /api/auth/*.</p>
          </div>
          <div className="rounded-lg border border-slate-100 p-3">
            <p className="text-sm font-semibold text-slate-900">Data Kontak</p>
            <p className="text-xs text-slate-500">Nomor telepon, alamat email, dan preferensi komunikasi.</p>
          </div>
        </div>
      </section>

      {/* Sign out */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {signingOut ? "Keluar..." : "Keluar (Logout)"}
        </button>
      </section>
    </div>
  );
}