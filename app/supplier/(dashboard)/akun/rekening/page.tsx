import type { Metadata } from "next";
import DisbursementSetupClient from "@/components/supplier/disbursement/DisbursementSetupClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengaturan Rekening | Wesup",
  description:
    "Atur rekening tujuan pencairan dana escrow dan pantau pencairan Anda di Wesup.",
};

export default function SupplierDisbursementPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <DisbursementSetupClient />
      </div>
    </main>
  );
}
