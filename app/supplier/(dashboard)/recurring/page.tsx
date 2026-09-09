import type { Metadata } from "next";
import RecurringListClient from "@/components/supplier/recurring/RecurringListClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Postingan Berulang | Wesup",
  description: "Kelola jadwal penawaran otomatis yang tayang berulang di Wesup.",
};

export default function RecurringPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <RecurringListClient />
      </div>
    </main>
  );
}
