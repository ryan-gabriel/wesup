import Link from "next/link";
import { ArrowRight, MapPin, ShieldCheck, ShoppingBag, Wallet } from "lucide-react";

const TRUST_MARKERS = [
    { icon: ShieldCheck, label: "Dana aman via Escrow 24 jam" },
    { icon: Wallet, label: "Bayar sekali pakai QRIS" },
    { icon: MapPin, label: "Ambil sendiri di Bandung" },
] as const;

const TIER_STEPS = [
    { label: "Tier 1", quota: "Mulai 100 kg", unitPrice: "Rp 12.000/kg" },
    { label: "Tier 2", quota: "250 kg", unitPrice: "Rp 10.500/kg" },
    { label: "Tier 3", quota: "500 kg", unitPrice: "Rp 8.900/kg" },
] as const;

export function Hero() {
    return (
        <section className="relative overflow-hidden">
            {/* Decorative background */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50 via-slate-50 to-white" aria-hidden="true" />
            <div className="absolute inset-x-0 -top-40 -z-10 h-[36rem] overflow-hidden blur-3xl pointer-events-none" aria-hidden="true">
                <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#bfdbfe] to-[#3b82f6] opacity-30" />
            </div>

            <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-20 pt-16 sm:px-6 md:pb-28 md:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
                <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-1.5 text-sm font-semibold text-blue-700 shadow-sm">
                        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
                        </span>
                        Khusus UMKM di Bandung
                    </span>

                    <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl text-balance">
                        Belanja Bahan Baku Lebih Hemat,{" "}
                        <span className="relative whitespace-nowrap">
                            <span className="relative z-10 text-blue-600">Beli Bersama</span>
                            <svg aria-hidden="true" viewBox="0 0 418 42" className="absolute left-0 top-2/3 h-[0.58em] w-full fill-blue-300/40" preserveAspectRatio="none">
                                <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.738 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.051.951.569 2.296 1.116 2.876.527.559 7.076 2.581 18.073 5.578 21.2 5.772 49.333 9.69 82.5 11.458 13.918.739 32.81.996 46.696.633 78.441-2.054 153.945-12.222 232.062-31.258 5.419-1.32 10.87-2.671 12.115-3.003 3.51-1.042 3.195-2.906-1.059-6.22-4.103-3.21-10.741-6.177-18.74-8.384-18.016-4.966-41.97-9.014-69.605-11.758-29.351-2.915-77.01-4.084-100.661-1.614z" />
                            </svg>
                        </span>{" "}
                        UMKM Lain
                    </h1>

                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl text-pretty">
                        Gabungkan permintaan dengan ratusan UMKM lain, buka harga tier diskon yang semakin murah,
                        dan ambil sendiri bahan baku di titik kumpul supplier — tanpa ongkos kirim last-mile.
                    </p>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Link
                            href="/marketplace"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98]"
                        >
                            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                            Mulai Belanja
                        </Link>
                        <a
                            href="#cara-kerja"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 transition-all hover:bg-slate-50 hover:ring-slate-300 active:scale-[0.98]"
                        >
                            Lihat Cara Kerja
                            <ArrowRight className="h-5 w-5 text-slate-500" aria-hidden="true" />
                        </a>
                    </div>

                    <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
                        {TRUST_MARKERS.map((marker) => (
                            <li key={marker.label} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                                <marker.icon className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
                                {marker.label}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Mock tier-progress card — visualizes the core value prop */}
                <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-blue-900/5 sm:p-8">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Batch #482</p>
                                <h3 className="mt-1 text-xl font-bold text-slate-900">Cabai Merah Keriting</h3>
                                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                                    <MapPin className="h-4 w-4 text-blue-600" aria-hidden="true" />
                                    Pasar Induk · dekat lokasi Anda
                                </p>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                Masih berjalan
                            </span>
                        </div>

                        <div className="mt-6">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-slate-700">Kuota terkumpul</span>
                                <span className="font-bold text-blue-700 tabular-nums">298/500 kg</span>
                            </div>
                            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full w-[60%] rounded-full bg-gradient-to-r from-blue-500 to-blue-600" />
                            </div>
                        </div>

                        <ul className="mt-6 space-y-3">
                            {TIER_STEPS.map((tier) => (
                                <li
                                    key={tier.label}
                                    className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${tier.label === "Tier 2" ? "border-blue-200 bg-blue-50/60 ring-1 ring-inset ring-blue-200" : "border-slate-200 bg-white"}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold ${tier.label === "Tier 2" ? "text-blue-700" : "text-slate-700"}`}>{tier.label}</span>
                                        <span className="text-slate-500">{tier.quota}</span>
                                    </div>
                                    <span className={`font-bold tabular-nums ${tier.label === "Tier 2" ? "text-blue-700" : "text-slate-700"}`}>{tier.unitPrice}</span>
                                </li>
                            ))}
                        </ul>

                        <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
                            Semakin banyak yang bergabung, harga semakin murah —{" "}
                            <span className="font-bold text-slate-900">diskon terkunci otomatis</span> saat pendaftaran ditutup.
                        </p>
                    </div>
                    <div className="absolute -bottom-6 -left-6 -z-10 h-40 w-40 rounded-full bg-blue-200/50 blur-3xl" />
                    <div className="absolute -right-6 -top-6 -z-10 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl" />
                </div>
            </div>
        </section>
    );
}