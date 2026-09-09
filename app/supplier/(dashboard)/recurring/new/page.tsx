import type { Metadata } from "next";
import RecurringForm from "@/components/supplier/recurring/RecurringForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buat Jadwal Baru | Wesup",
  description: "Buat jadwal postingan otomatis yang tayang berulang di Wesup.",
};

export default function NewRecurringPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 text-center sm:mb-10">
          <span className="inline-flex rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-blue-700 shadow-sm">
            Postingan Berulang
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Buat Jadwal Baru
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Atur penawaran otomatis yang tayang berulang sesuai interval dan hari yang Anda pilih.
          </p>
        </header>
        <RecurringForm />
      </div>
    </main>
  );
}
