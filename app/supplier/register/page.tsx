import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import SupplierRegistrationForm from "@/components/supplier/SupplierRegistrationForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pendaftaran Pemasok | Wesup",
  description: "Daftar sebagai mitra pemasok bahan baku UMKM di Wesup.",
};

export default function SupplierRegistrationPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_38%),linear-gradient(180deg,_#f8fafc,_#eff6ff)] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 text-center sm:mb-10">
          <span className="inline-flex rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-700 shadow-sm">
            Mitra Wesup
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Pendaftaran Pemasok
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Bergabunglah sebagai mitra pemasok bahan baku UMKM dan bantu usaha lokal tumbuh bersama.
          </p>
        </header>

        <SupplierRegistrationForm />
      </div>
    </main>
  );
}
