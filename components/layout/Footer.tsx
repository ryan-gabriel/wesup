import Link from "next/link";

export function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="mt-auto border-t border-gray-100 bg-white">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
                    {/* Brand column */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white text-xs font-bold">
                                W
                            </span>
                            <span className="text-sm font-bold text-gray-900">Wesup</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
                            Platform pembelian kolektif bahan baku untuk UMKM Bandung dengan sistem escrow &amp; tier diskon otomatis.
                        </p>
                    </div>

                    {/* Platform links */}
                    <div>
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                            Platform
                        </h4>
                        <ul className="space-y-2">
                            {[
                                { href: "/marketplace", label: "Marketplace" },
                                { href: "/pesanan", label: "Pesanan Saya" },
                                { href: "/notifikasi", label: "Notifikasi" },
                            ].map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* About links */}
                    <div>
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                            Tentang
                        </h4>
                        <ul className="space-y-2">
                            {[
                                { href: "/tentang", label: "Tentang Wesup" },
                                { href: "/syarat", label: "Syarat & Ketentuan" },
                                { href: "/privasi", label: "Kebijakan Privasi" },
                            ].map((link) => (
                                <li key={link.href}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="mt-8 border-t border-gray-100 pt-4 text-center text-xs text-gray-400">
                    © {year} Wesup — INSEVENT 2026 · Fullstack Web Development Competition
                </div>
            </div>
        </footer>
    );
}
