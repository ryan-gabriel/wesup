"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// ── Icons (inline SVG — zero extra dependency) ─────────────────────────────

function IconHome() {
    return (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4 10v10a1 1 0 001 1h5V14h4v7h5a1 1 0 001-1V10" />
        </svg>
    );
}

function IconStore() {
    return (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18l-2 9H5L3 3zM5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" />
        </svg>
    );
}

function IconClipboard() {
    return (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
    );
}

function IconBell() {
    return (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
    );
}

function IconUser() {
    return (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    );
}

function IconSupplier() {
    return (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
    );
}

// ── Nav items definition ───────────────────────────────────────────────────

const navItems = [
    { href: "/", label: "Beranda", icon: <IconHome /> },
    { href: "/marketplace", label: "Marketplace", icon: <IconStore /> },
    { href: "/supplier", label: "Supplier", icon: <IconSupplier /> },
    { href: "/pesanan", label: "Pesanan", icon: <IconClipboard /> },
    { href: "/notifikasi", label: "Notifikasi", icon: <IconBell /> },
    { href: "/akun", label: "Akun", icon: <IconUser /> },
] as const;

// ── Component ──────────────────────────────────────────────────────────────

export function NavigationBar() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-sm">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                {/* Brand */}
                <Link
                    href="/"
                    className="flex items-center gap-2 text-slate-900 hover:opacity-80 transition-opacity"
                    aria-label="Wesup - Kembali ke Beranda"
                >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white text-sm font-bold shadow-sm shadow-blue-600/20" aria-hidden="true">
                        W
                    </span>
                    <span className="text-lg font-extrabold tracking-tight">Wesup</span>
                </Link>

                {/* Desktop nav */}
                <nav aria-label="Navigasi utama" className="hidden md:flex items-center gap-1">
                    {navItems.map((item) => {
                        const isActive =
                            item.href === "/"
                                ? pathname === "/"
                                : pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? "page" : undefined}
                                className={cn(
                                    "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                )}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Mobile — bottom bar handled separately, keep header clean */}
                <div className="flex md:hidden items-center gap-2 text-sm text-slate-400">
                    <span>Menu</span>
                </div>
            </div>

            {/* Mobile bottom navigation */}
            <MobileNav pathname={pathname} />
        </header>
    );
}

function MobileNav({ pathname }: { pathname: string }) {
    return (
        <nav
            aria-label="Navigasi bawah (mobile)"
            className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around border-t border-slate-200 bg-white px-2 py-2"
        >
            {navItems.map((item) => {
                const isActive =
                    item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            "flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px] font-medium transition-colors",
                            isActive
                                ? "text-blue-700"
                                : "text-slate-500 hover:text-slate-800"
                        )}
                    >
                        {/* icon + text always horizontal on desktop, stacked only on mobile bottom bar */}
                        <span className={cn("flex items-center gap-1", isActive && "text-blue-700")}>
                            {item.icon}
                        </span>
                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
