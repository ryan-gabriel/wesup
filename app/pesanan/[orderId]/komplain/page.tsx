import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layout } from "@/components/layout/Layout";
import ComplaintFormClient from "@/components/disputes/ComplaintFormClient";
import { getAccountOrderMock } from "@/lib/orders/mock-data";
import { getComplaintScenario } from "@/lib/dispute/mock-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ajukan Komplain | Wesup",
  description:
    "Ajukan komplain barang cacat/busuk dan bekukan dana escrow dalam jendela 1x24 jam di Wesup.",
};

export default async function ComplaintPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = getAccountOrderMock(orderId);

  if (!order) {
    notFound();
  }

  const scenario = getComplaintScenario(orderId);

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <ComplaintFormClient order={order} scenario={scenario} />
      </div>
    </Layout>
  );
}