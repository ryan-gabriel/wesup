import type { Metadata } from "next";
import ReportFormClient from "@/components/supplier/report/ReportFormClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lapor UMKM Bermasalah | Wesup",
  description:
    "Laporkan UMKM bermasalah beserta bukti foto untuk proses verifikasi di Wesup.",
};

export default function SupplierReportFormPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <ReportFormClient />
      </div>
    </main>
  );
}
