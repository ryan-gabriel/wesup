"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, Menu, ShoppingBag, X } from "lucide-react";

const NAV_LINKS = [
    { href: "#fitur", label: "Fitur" },
    { href: "#cara-kerja", label: "Cara Kerja" },
    { href: "#faq", label: "FAQ" },
] as const;

/**
 * Marketing header for the UMKM landing page (/beranda-umkm).
 * Distinct from the in-app NavigationBar: anchors + conversion CTAs.
 */
export function LandingHeader() {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuId = useId();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
                {/* Brand */}
                <Link
                    href="/beranda-umkm"
                    className="flex items-center gap-2 text-slate-900 transition-opacity hover:opacity-80"
                    aria-label="Wesup — Beranda UMKM"
                >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white shadow-sm shadow-blue-600/20" aria-hidden="true">
                        W
                    </span>
                    <span className="text-lg font-extrabold tracking-tight">Wesup</span>
                </Link>

                {/* Desktop nav */}
                <nav aria-label="Navigasi beranda" className="hidden md:flex items-center gap-1">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                            {link.label}
                        </a>
                    ))}
                </nav>

                {/* Desktop CTAs */}
                <div className="hidden md:flex items-center gap-3">
                    <Link
                        href="/login"
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
                    >
                        Masuk
                    </Link>
                    <Link
                        href="/marketplace"
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98]"
                    >
                        <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                        Mulai Belanja
                    </Link>
                </div>

                {/* Mobile menu toggle */}
                <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                    aria-controls={menuId}
                    aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 md:hidden active:scale-[0.96]"
                >
                    {menuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
                </button>
            </div>

            {/* Mobile menu */}
            {menuOpen ? (
                <nav id={menuId} aria-label="Navigasi beranda (mobile)" className="border-t border-slate-200 bg-white px-4 pb-6 pt-2 md:hidden">
                    <div className="flex flex-col gap-1">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                onClick={() => setMenuOpen(false)}
                                className="rounded-lg px-3 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100"
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                    <div className="mt-4 flex flex-col gap-3">
                        <Link
                            href="/login"
                            onClick={() => setMenuOpen(false)}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            Masuk
                        </Link>
                        <Link
                            href="/marketplace"
                            onClick={() => setMenuOpen(false)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-[0.98]"
                        >
                            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                            Mulai Belanja
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                </nav>
            ) : null}
        </header>
    );
}