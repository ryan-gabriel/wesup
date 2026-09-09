import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layout } from "@/components/layout/Layout";
import RefundAccountFormClient from "@/components/disputes/RefundAccountFormClient";
import { getAccountOrderMock } from "@/lib/orders/mock-data";
import { getComplaintScenario } from "@/lib/dispute/mock-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rekening Refund | Wesup",
  description:
    "Isi rekening manual untuk pengembalian dana penuh setelah sengketa dimenangkan di Wesup.",
};

export default async function RefundAccountPage({
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
  const refund =
    scenario?.kind === "filed" ? scenario.refund : null;

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <RefundAccountFormClient order={order} refund={refund} />
      </div>
    </Layout>
  );
}