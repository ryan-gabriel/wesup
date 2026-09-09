import type { Metadata } from "next";
import EditCatalogForm from "@/components/supplier/catalog/EditCatalogForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit Penawaran | Wesup",
  description: "Ubah detail penawaran bahan baku Anda di Wesup.",
};

export default async function EditCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 text-center sm:mb-10">
          <span className="inline-flex rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-700 shadow-sm">
            Edit
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Edit Penawaran
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Ubah detail penawaran Anda yang sedang aktif.
          </p>
        </header>
        <EditCatalogForm key={id} />
      </div>
    </main>
  );
}
