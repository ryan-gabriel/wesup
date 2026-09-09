import type { Metadata } from "next";
import CatalogListClient from "@/components/supplier/catalog/CatalogListClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Katalog Saya | Wesup",
  description: "Kelola seluruh penawaran katalog bahan baku Anda di Wesup.",
};

export default function SupplierCatalogPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <CatalogListClient />
      </div>
    </main>
  );
}
