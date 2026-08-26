import type { Metadata } from "next";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { LeafletDemoClient } from "@/components/demo/LeafletDemoClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo Peta Leaflet",
  description:
    "Demo interaktif pemilihan titik pengambilan Wesup menggunakan Leaflet dan OpenStreetMap.",
};

export default function LeafletDemoPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d1fae5,_transparent_36%),linear-gradient(180deg,_#f8fafc,_#ecfdf5)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 transition hover:text-emerald-600"
        >
          <span aria-hidden="true">←</span>
          Kembali ke beranda
        </Link>

        <header className="mb-8 mt-8 max-w-3xl">
          <span className="inline-flex rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 shadow-sm">
            Test Map
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Pilih koordinat lokasi 
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            Klik peta untuk memindahkan titik, bisa pake lokasi user
          </p>
        </header>

        <LeafletDemoClient />
      </div>
    </main>
  );
}
