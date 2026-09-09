import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SupplierReviewsClient from "@/components/supplier/reputation/SupplierReviewsClient";
import { getSupplierRatings } from "@/lib/supplier-ratings/mock-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Penilaian & Ulasan | Wesup",
  description:
    "Pantau reputasi supplier dari penilaian dan ulasan UMKM di Wesup.",
};

const MOCK_SUPPLIER_NAME = process.env.WESUP_MOCK_SUPPLIER_NAME ?? "Koperasi Pangan Bandung";

export default function SupplierReviewsPage() {
  const ratings = getSupplierRatings(MOCK_SUPPLIER_NAME);

  if (!ratings) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <SupplierReviewsClient ratings={ratings} />
      </div>
    </main>
  );
}