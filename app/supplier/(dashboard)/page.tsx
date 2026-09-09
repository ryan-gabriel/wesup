import type { Metadata } from "next";
import SupplierDashboard from "@/components/supplier/dashboard/SupplierDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dasbor Pemasok | Wesup",
  description: "Kelola penawaran, pesanan, dan aktivitas pemasok Anda di Wesup.",
};

export default function SupplierDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <SupplierDashboard />
      </div>
    </main>
  );
}
