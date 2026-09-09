"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function MarketplaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
      role="alert"
    >
      <AlertCircle aria-hidden="true" className="mb-4 h-12 w-12 text-red-400" />
      <h2 className="text-xl font-bold text-slate-800">Marketplace belum bisa dimuat</h2>
      <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">
        Terjadi kendala sementara saat mengambil penawaran. Silakan coba lagi.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Coba lagi
      </button>
    </div>
  );
}
