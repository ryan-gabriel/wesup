import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layout } from "@/components/layout/Layout";
import ComplaintStatusClient from "@/components/disputes/ComplaintStatusClient";
import { getAccountOrderMock } from "@/lib/orders/mock-data";
import { getComplaintScenario } from "@/lib/dispute/mock-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lacak Sengketa | Wesup",
  description:
    "Pantau status sengketa escrow, dana yang dibekukan, dan keputusan Arbiter di Wesup.",
};

export default async function ComplaintStatusPage({
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
        <ComplaintStatusClient order={order} scenario={scenario} />
      </div>
    </Layout>
  );
}