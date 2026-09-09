"use client";

import { useEffect, useId, useRef, useState } from "react";
import type React from "react";
import { Building2 } from "lucide-react";
import type { AsyncPhase } from "@/lib/supplier-disbursement/types";

export interface AddBankAccountDialogProps {
  open: boolean;
  phase: AsyncPhase;
  error: string | null;
  onCancel: () => void;
  onSubmit: (data: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    isPrimary?: boolean;
  }) => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}

interface FormErrors {
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
}

export default function AddBankAccountDialog({
  open,
  phase,
  error,
  onCancel,
  onSubmit,
  returnFocusRef,
}: AddBankAccountDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const formTitleId = useId();
  const formDescId = useId();
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const loading = phase === "loading";

  const resetForm = () => {
    setBankName("");
    setAccountNumber("");
    setAccountHolderName("");
    setIsPrimary(false);
    setErrors({});
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
     
  }, [open]);

  const dismiss = () => {
    if (loading) return;
    resetForm();
    onCancel();
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!bankName.trim()) next.bankName = "Nama bank wajib diisi.";
    if (!accountNumber.trim()) next.accountNumber = "Nomor rekening wajib diisi.";
    else if (!/^\d+$/.test(accountNumber.trim()))
      next.accountNumber = "Nomor rekening hanya boleh berisi angka.";
    if (!accountHolderName.trim())
      next.accountHolderName = "Nama pemilik rekening wajib diisi.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;
    onSubmit({
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountHolderName: accountHolderName.trim(),
      isPrimary,
    });
    resetForm();
  };

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <dialog
      ref={ref}
      aria-labelledby={formTitleId}
      aria-describedby={formDescId}
      className="fixed left-1/2 top-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClose={() => {
        if (loading) {
          ref.current?.showModal();
          return;
        }
        onCancel();
        if (returnFocusRef.current && !returnFocusRef.current.disabled) {
          returnFocusRef.current.focus();
        }
      }}
    >
      <form className="p-6" onSubmit={handleSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={formTitleId} className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Building2 size={20} className="text-blue-600" aria-hidden="true" />
              Tambah Rekening
            </h2>
            <p id={formDescId} className="mt-2 text-sm leading-6 text-gray-600">
              Rekening ini akan menjadi tujuan pencairan dana escrow Anda.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Tutup dialog tambah rekening"
            disabled={loading}
            onClick={dismiss}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true" className="text-2xl leading-none">×</span>
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor={`${formTitleId}-bank`} className="block text-sm font-semibold text-slate-800">
              Nama Bank
            </label>
            <select
              id={`${formTitleId}-bank`}
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
                errors.bankName ? "border-red-300" : "border-slate-300"
              }`}
            >
              <option value="">Pilih bank</option>
              <option value="Bank Central Asia (BCA)">Bank Central Asia (BCA)</option>
              <option value="Bank Mandiri">Bank Mandiri</option>
              <option value="Bank Rakyat Indonesia (BRI)">Bank Rakyat Indonesia (BRI)</option>
              <option value="Bank Negara Indonesia (BNI)">Bank Negara Indonesia (BNI)</option>
              <option value="Bank Jago">Bank Jago</option>
            </select>
            {errors.bankName && (
              <p className="mt-1 text-xs font-medium text-red-600">{errors.bankName}</p>
            )}
          </div>

          <div>
            <label htmlFor={`${formTitleId}-number`} className="block text-sm font-semibold text-slate-800">
              Nomor Rekening
            </label>
            <input
              id={`${formTitleId}-number`}
              type="text"
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="0123456789"
              autoComplete="off"
              className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
                errors.accountNumber ? "border-red-300" : "border-slate-300"
              }`}
            />
            {errors.accountNumber && (
              <p className="mt-1 text-xs font-medium text-red-600">{errors.accountNumber}</p>
            )}
          </div>

          <div>
            <label htmlFor={`${formTitleId}-holder`} className="block text-sm font-semibold text-slate-800">
              Nama Pemilik Rekening
            </label>
            <input
              id={`${formTitleId}-holder`}
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Nama sesuai rekening"
              autoComplete="off"
              className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
                errors.accountHolderName ? "border-red-300" : "border-slate-300"
              }`}
            />
            {errors.accountHolderName && (
              <p className="mt-1 text-xs font-medium text-red-600">{errors.accountHolderName}</p>
            )}
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">
              Jadikan rekening utama
            </span>
          </label>
        </div>

        {error && (
          <p role="alert" aria-live="assertive" aria-atomic="true" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={dismiss}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Menyimpan…" : "Simpan Rekening"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
