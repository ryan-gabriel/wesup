import { Suspense } from "react";
import type { Metadata } from "next";
import PickupScannerClient from "@/components/supplier/fulfillment/PickupScannerClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Serah Terima | Wesup",
  description:
    "Validasi pengambilan barang UMKM melalui pindai QR atau PIN untuk batch Anda di Wesup.",
};

export default async function SupplierBatchPickupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Suspense>
          <PickupScannerClient key={id} batchId={id} />
        </Suspense>
      </div>
    </main>
  );
}
