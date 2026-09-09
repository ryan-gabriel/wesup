import type { Metadata } from "next";
import {
    CtaSection,
    Features,
    Hero,
    HowItWorks,
    LandingFaq,
    LandingFooter,
    LandingHeader,
} from "@/components/landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Panduan & Fitur UMKM",
    description:
        "Belanja bahan baku lebih hemat bersama ratusan UMKM lain di Bandung. Sistem tier diskon kolektif, pembayaran QRIS, escrow 24 jam, dan self-pickup tanpa ongkir.",
    openGraph: {
        title: "Wesup — Panduan & Fitur UMKM",
        description:
            "Belanja bahan baku lebih hemat bersama ratusan UMKM lain di Bandung. Tier diskon kolektif, QRIS, escrow 24 jam, self-pickup tanpa ongkir.",
        siteName: "Wesup",
        locale: "id_ID",
        type: "website",
    },
};

export default function BerandaUmkmPage() {
    return (
        <div className="flex min-h-screen flex-col bg-white text-slate-900">
            <LandingHeader />
            <main className="flex-1">
                <Hero />
                <Features />
                <HowItWorks />
                <LandingFaq />
                <CtaSection />
            </main>
            <LandingFooter />
        </div>
    );
}