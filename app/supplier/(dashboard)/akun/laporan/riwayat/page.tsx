import type { Metadata } from "next";
import ReportHistoryClient from "@/components/supplier/report/ReportHistoryClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Riwayat Laporan | Wesup",
  description:
    "Lacak status laporan UMKM bermasalah yang Anda kirim di Wesup.",
};

export default function SupplierReportHistoryPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <ReportHistoryClient />
      </div>
    </main>
  );
}
