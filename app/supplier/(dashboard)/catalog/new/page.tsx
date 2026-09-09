import type { Metadata } from "next";
import CreateCatalogForm from "@/components/supplier/catalog/CreateCatalogForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buat Penawaran Baru | Wesup",
  description: "Buat penawaran bahan baku baru untuk UMKM di Bandung.",
};

export default function NewCatalogPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 text-center sm:mb-10">
          <span className="inline-flex rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-700 shadow-sm">
            Penawaran Baru
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Buat Penawaran
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Isi detail penawaran bahan baku Anda untuk UMKM di Bandung.
          </p>
        </header>
        <CreateCatalogForm />
      </div>
    </main>
  );
}
