import Link from "next/link";
import { ArrowRight, Percent, QrCode, Search, ShieldCheck, Star, Wallet } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const FEATURES = [
    {
        href: "/marketplace",
        icon: Search,
        iconClass: "bg-blue-50 text-blue-600 ring-blue-100 group-hover:bg-blue-100",
        title: "Pencarian & Etalase Cerdas",
        description:
            "Cari bahan baku dengan filter kategori, rentang harga, dan radius lokasi. Jarak serta estimasi waktu ke titik kumpul supplier dihitung otomatis.",
    },
    {
        href: "/marketplace",
        icon: Percent,
        iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100 group-hover:bg-emerald-100",
        title: "Diskon Tier Volume Kolektif",
        description:
            "Gabung bersama UMKM lain untuk menaikkan volume kuota dan membuka harga tier yang lebih murah. Progress kuota tampil real-time dan harga terkunci saat cutoff.",
    },
    {
        href: "/login",
        icon: Wallet,
        iconClass: "bg-purple-50 text-purple-600 ring-purple-100 group-hover:bg-purple-100",
        title: "Pembayaran QRIS Terkunci Waktu",
        description:
            "Tagihan final diterbitkan setelah kuota ditutup, dengan countdown berbasis server agar tidak bisa dimanipulasi. Cukup satu kali scan QRIS di Payment Window.",
    },
    {
        href: "/pesanan",
        icon: QrCode,
        iconClass: "bg-amber-50 text-amber-600 ring-amber-100 group-hover:bg-amber-100",
        title: "Dasbor Pesanan & Serah Terima",
        description:
            "Pantau status pesanan dari pendaftaran hingga diambil. Terima Kode QR pengambilan plus PIN 4-digit cadangan untuk bukti serah terima di titik kumpul.",
    },
    {
        href: "/pesanan",
        icon: ShieldCheck,
        iconClass: "bg-rose-50 text-rose-600 ring-rose-100 group-hover:bg-rose-100",
        title: "Escrow 24 Jam & Komplain",
        description:
            "Dana Anda ditahan aman 24 jam setelah barang diambil. Barang rusak? Ajukan komplain dengan bukti foto dalam waktu 24 jam sebelum dana cair ke supplier.",
    },
    {
        href: "/marketplace",
        icon: Star,
        iconClass: "bg-cyan-50 text-cyan-600 ring-cyan-100 group-hover:bg-cyan-100",
        title: "Rating & Ulasan Supplier",
        description:
            "Nilai pengalaman serah terima dengan bintang 1–5 dan ulasan tertulis setelah transaksi rampung, membantu UMKM lain memilih supplier terpercaya.",
    },
] as const;

export function Features() {
    return (
        <section id="fitur" className="scroll-mt-24 py-20 md:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <SectionHeading
                    eyebrow="Fitur UMKM"
                    title="Semua yang Anda butuhkan untuk berbelanja hemat"
                    description="Enam fitur inti dirancang agar pengadaan bahan baku Anda lebih murah, aman, dan transparan — dari mencari hingga menilai supplier."
                />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map((feature) => (
                        <Link
                            key={feature.title}
                            href={feature.href}
                            className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                            <span className={`mb-5 inline-flex w-fit rounded-xl p-3 ring-1 ring-inset transition-colors ${feature.iconClass}`}>
                                <feature.icon className="h-6 w-6" aria-hidden="true" />
                            </span>
                            <h3 className="text-lg font-bold tracking-tight text-slate-900 text-balance">
                                {feature.title}
                            </h3>
                            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 text-pretty">
                                {feature.description}
                            </p>
                            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition-colors group-hover:text-blue-700">
                                Coba sekarang
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}