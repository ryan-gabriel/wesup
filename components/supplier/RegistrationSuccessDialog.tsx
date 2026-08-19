"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles, X } from "lucide-react";

export default function RegistrationSuccessDialog({
  open,
  requiresEmailConfirmation,
  onClose,
}: {
  open: boolean;
  requiresEmailConfirmation: boolean;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="success-backdrop-enter fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="success-dialog-enter relative w-full max-w-md overflow-hidden rounded-3xl border border-blue-100 bg-white p-7 text-center shadow-2xl sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-success-title"
        aria-describedby="registration-success-description"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-100/70 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-sky-100/70 blur-2xl" />

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Tutup dialog"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          <span className="success-ring absolute h-20 w-20 rounded-full border-2 border-blue-300" aria-hidden="true" />
          <span className="success-ring success-ring-delay absolute h-20 w-20 rounded-full border-2 border-blue-200" aria-hidden="true" />
          <div className="success-icon-enter relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200">
            <CheckCircle2 className="h-9 w-9" strokeWidth={2.4} aria-hidden="true" />
          </div>
          <Sparkles className="success-sparkle absolute right-0 top-1 h-5 w-5 text-blue-500" aria-hidden="true" />
          <Sparkles className="success-sparkle success-sparkle-delay absolute bottom-2 left-0 h-4 w-4 text-sky-400" aria-hidden="true" />
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Pendaftaran selesai</p>
        <h2 id="registration-success-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Berhasil membuat akun
        </h2>
        <p id="registration-success-description" className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
          Akun pemasok Anda berhasil dibuat dan data usaha telah dikirim untuk proses verifikasi.
        </p>

        {requiresEmailConfirmation && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm leading-6 text-amber-900">
            Silakan cek email Anda untuk mengonfirmasi akun sebelum login ke Wesup.
          </div>
        )}

        <div className="relative mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:translate-y-0"
          >
            Kembali ke beranda
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:translate-y-0"
          >Login</Link>
        </div>

        <style jsx>{`
          @keyframes success-backdrop-enter {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes success-dialog-enter {
            0% { opacity: 0; transform: translateY(18px) scale(0.94); }
            70% { transform: translateY(-2px) scale(1.01); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }

          @keyframes success-icon-enter {
            0% { opacity: 0; transform: scale(0.35) rotate(-18deg); }
            65% { transform: scale(1.12) rotate(4deg); }
            100% { opacity: 1; transform: scale(1) rotate(0); }
          }

          @keyframes success-ring {
            0% { opacity: 0.8; transform: scale(0.72); }
            100% { opacity: 0; transform: scale(1.45); }
          }

          @keyframes success-sparkle {
            0%, 100% { opacity: 0.45; transform: translateY(0) rotate(0); }
            50% { opacity: 1; transform: translateY(-5px) rotate(12deg); }
          }

          .success-backdrop-enter {
            animation: success-backdrop-enter 180ms ease-out both;
          }

          .success-dialog-enter {
            animation: success-dialog-enter 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          .success-icon-enter {
            animation: success-icon-enter 520ms 120ms cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          .success-ring {
            animation: success-ring 900ms 260ms ease-out both;
          }

          .success-ring-delay {
            animation-delay: 420ms;
          }

          .success-sparkle {
            animation: success-sparkle 1.8s 500ms ease-in-out infinite;
          }

          .success-sparkle-delay {
            animation-delay: 900ms;
          }

          @media (prefers-reduced-motion: reduce) {
            .success-backdrop-enter,
            .success-dialog-enter,
            .success-icon-enter,
            .success-ring,
            .success-sparkle {
              animation: none;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
