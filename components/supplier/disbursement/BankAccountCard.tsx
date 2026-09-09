import { Building2, CheckCircle2, Trash2 } from "lucide-react";
import type { SupplierBankAccount } from "@/lib/supplier-disbursement/types";

export interface BankAccountCardProps {
  account: SupplierBankAccount;
  onRemove?: (accountId: string) => void;
  disabled?: boolean;
}

export default function BankAccountCard({
  account,
  onRemove,
  disabled = false,
}: BankAccountCardProps) {
  return (
    <div
      className={`relative rounded-xl border bg-white p-4 shadow-sm transition ${
        account.isPrimary
          ? "border-blue-200 ring-1 ring-blue-100"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            account.isPrimary ? "bg-blue-100" : "bg-slate-100"
          }`}
        >
          <Building2
            size={20}
            className={account.isPrimary ? "text-blue-600" : "text-slate-500"}
            aria-hidden="true"
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-slate-900">
              {account.bankName}
            </p>
            {account.isPrimary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                <CheckCircle2 size={10} aria-hidden="true" />
                Utama
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-sm text-slate-700">
            {account.accountNumber}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {account.accountHolderName}
          </p>
        </div>

        {onRemove && !account.isPrimary && (
          <button
            type="button"
            onClick={() => onRemove(account.id)}
            disabled={disabled}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            aria-label={`Hapus rekening ${account.bankName}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
