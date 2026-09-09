import type { Metadata } from "next";
import EscrowMonitorClient from "@/components/supplier/disbursement/EscrowMonitorClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Monitoring Escrow | Wesup",
  description:
    "Pantau dana escrow yang masuk, dibekukan, dirilis, atau hangus di Wesup.",
};

export default function SupplierEscrowPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <EscrowMonitorClient />
      </div>
    </main>
  );
}
