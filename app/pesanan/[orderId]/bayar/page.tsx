import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layout } from "@/components/layout/Layout";
import PaymentWindowClient from "@/components/payments/PaymentWindowClient";
import { getPaymentInvoiceMock } from "@/lib/payments/mock-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bayar Tagihan | Wesup",
  description: "Selesaikan pembayaran tagihan QRIS di dalam Payment Window.",
};

export default async function PaymentWindowPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const invoice = getPaymentInvoiceMock(orderId);

  if (!invoice) {
    notFound();
  }

  return (
    <Layout>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <PaymentWindowClient invoice={invoice} />
      </div>
    </Layout>
  );
}