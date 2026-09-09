import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layout } from "@/components/layout/Layout";
import PickupCredentialClient from "@/components/orders/PickupCredentialClient";
import { getPickupCredentialMock } from "@/lib/orders/pickup-credential-mock";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Serah Terima | Wesup",
  description:
    "Kode QR pengambilan dan PIN 4 digit untuk serah terima pesanan Anda di Wesup.",
};

export default async function PickupCredentialPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const credential = getPickupCredentialMock(orderId);

  if (!credential) {
    notFound();
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <PickupCredentialClient credential={credential} />
      </div>
    </Layout>
  );
}