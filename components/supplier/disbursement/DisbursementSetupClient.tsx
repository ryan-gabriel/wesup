"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, Landmark, Plus, Wallet } from "lucide-react";
import { useToast } from "@/components/ui/GlobalToast";
import {
  SUPPLIER_BANK_ACCOUNT_MOCKS,
  type AsyncPhase,
  type SupplierBankAccountInput,
} from "@/lib/supplier-disbursement";
import BankAccountCard from "./BankAccountCard";
import AddBankAccountDialog from "./AddBankAccountDialog";

const SUPPLIER_ID = "supplier-001";

export default function DisbursementSetupClient() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState([
    ...SUPPLIER_BANK_ACCOUNT_MOCKS,
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPhase, setDialogPhase] = useState<AsyncPhase>("idle");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const primaryCount = accounts.filter((a) => a.isPrimary).length;
  const totalRekening = accounts.length;

  const openAddDialog = () => {
    setDialogError(null);
    setDialogPhase("idle");
    setDialogOpen(true);
  };

  const handleAddSubmit = (data: SupplierBankAccountInput) => {
    setDialogPhase("loading");
    setDialogError(null);
    // Simulate async add (UI-only, no backend).
    window.setTimeout(() => {
      const next: typeof accounts = [...accounts];
      if (data.isPrimary) {
        next.forEach((a) => {
          a.isPrimary = false;
        });
      }
      next.push({
        id: `bank-${Date.now()}`,
        supplierId: SUPPLIER_ID,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountHolderName: data.accountHolderName,
        isPrimary: !!data.isPrimary,
        createdAt: new Date().toISOString(),
      });
      setAccounts(next);
      setDialogPhase("idle");
      setDialogOpen(false);
      toast(
        data.isPrimary
          ? "Rekening baru ditambahkan dan dijadikan rekening utama."
          : "Rekening baru berhasil ditambahkan.",
        "success",
      );
    }, 700);
  };

  const handleRemove = (accountId: string) => {
    const target = accounts.find((a) => a.id === accountId);
    if (target?.isPrimary) return;
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    toast(`Rekening ${target?.bankName ?? ""} dihapus.`, "info");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Pengaturan Rekening
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Atur rekening tujuan pencairan dana escrow dan pantau masuknya dana
            Anda.
          </p>
        </div>
        <button
          ref={addButtonRef}
          type="button"
          onClick={openAddDialog}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Plus aria-hidden="true" size={18} />
          Tambah Rekening
        </button>
      </header>

      {/* Summary */}
      <section
        aria-label="Ringkasan pencairan"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Landmark size={16} className="text-blue-600" aria-hidden="true" />
            Total Rekening
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totalRekening}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {primaryCount} rekening utama
          </p>
        </div>

        <Link
          href="/supplier/akun/escrow"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 sm:p-5"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Wallet size={16} className="text-emerald-600" aria-hidden="true" />
            Dana Pencairan
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totalRekening > 0 ? "Tersedia" : "Belum ada"}
          </p>
          <p className="mt-1 text-xs text-blue-600">
            Lihat monitoring escrow →
          </p>
        </Link>

        <Link
          href="/supplier/akun/laporan"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 sm:p-5"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Banknote size={16} className="text-amber-600" aria-hidden="true" />
            Laporan UMKM
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">Buat laporan</p>
          <p className="mt-1 text-xs text-blue-600">
            Laporkan UMKM bermasalah →
          </p>
        </Link>
      </section>

      {/* Bank accounts */}
      <section aria-label="Daftar rekening">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Rekening Bank
          </h2>
          {primaryCount === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <CheckCircle2 size={12} aria-hidden="true" />
              Tetapkan rekening utama
            </span>
          )}
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <Landmark
              aria-hidden="true"
              size={40}
              className="mx-auto text-slate-300"
            />
            <p className="mt-3 text-sm font-medium text-slate-500">
              Belum ada rekening. Tambahkan rekening untuk menerima pencairan
              dana escrow.
            </p>
            <button
              type="button"
              onClick={openAddDialog}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus aria-hidden="true" size={16} />
              Tambah Rekening
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <BankAccountCard
                key={account.id}
                account={account}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </section>

      <AddBankAccountDialog
        open={dialogOpen}
        phase={dialogPhase}
        error={dialogError}
        onCancel={() => {
          setDialogOpen(false);
          setDialogPhase("idle");
          setDialogError(null);
        }}
        onSubmit={handleAddSubmit}
        returnFocusRef={addButtonRef}
      />
    </div>
  );
}
