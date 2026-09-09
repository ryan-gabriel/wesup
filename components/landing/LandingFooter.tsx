import Link from "next/link";

export function LandingFooter() {
    const year = new Date().getFullYear();

    return (
        <footer className="border-t border-slate-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
                <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white" aria-hidden="true">
                            W
                        </span>
                        <div>
                            <p className="text-sm font-extrabold tracking-tight text-slate-900">Wesup</p>
                            <p className="text-xs text-slate-500">
                                Pembelian kolektif bahan baku UMKM — Bandung.
                            </p>
                        </div>
                    </div>

                    <nav aria-label="Tautan Wesup" className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <Link href="/beranda-umkm" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
                            Beranda
                        </Link>
                        <Link href="/marketplace" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
                            Marketplace
                        </Link>
                        <Link href="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
                            Masuk
                        </Link>
                    </nav>
                </div>

                <div className="mt-8 border-t border-slate-200 pt-5 text-center text-xs text-slate-400">
                    © {year} Wesup — INSEVENT 2026 · Fullstack Web Development Competition
                </div>
            </div>
        </footer>
    );
}