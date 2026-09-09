import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";

export function CtaSection() {
    return (
        <section id="mulai" className="scroll-mt-24 pb-20 md:pb-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="relative overflow-hidden rounded-3xl bg-blue-600 px-8 py-14 text-center shadow-xl shadow-blue-600/20 sm:px-12 md:py-16">
                    <div className="absolute inset-0 -z-0 opacity-20" aria-hidden="true">
                        <div className="absolute -left-16 -top-24 h-64 w-64 rounded-full bg-white blur-3xl" />
                        <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-blue-300 blur-3xl" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl text-balance">
                            Siap berbelanja bahan baku lebih hemat?
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100 text-pretty">
                            Gabung bersama ratusan UMKM lain, buka harga tier diskon, dan ambil sendiri di titik kumpul terdekat di Bandung.
                        </p>
                        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <Link
                                href="/marketplace"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-blue-700 shadow-sm transition-all hover:bg-blue-50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98] sm:w-auto"
                            >
                                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                                Jelajahi Marketplace
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-8 py-4 text-base font-semibold text-white ring-1 ring-inset ring-blue-400/60 transition-all hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98] sm:w-auto"
                            >
                                Masuk / Daftar
                                <ArrowRight className="h-5 w-5" aria-hidden="true" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}