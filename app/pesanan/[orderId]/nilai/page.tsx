import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Layout } from "@/components/layout/Layout";
import RatingFormClient from "@/components/ratings/RatingFormClient";
import { getAccountOrderMock } from "@/lib/orders/mock-data";
import { getRatingScenarioForOrder } from "@/lib/ratings/mock-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nilai & Ulas | Wesup",
  description:
    "Berikan penilaian bintang dan ulasan untuk kualitas pelayanan Supplier di Wesup.",
};

export default async function RatingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = getAccountOrderMock(orderId);

  if (!order) {
    notFound();
  }

  const scenario = getRatingScenarioForOrder(orderId);

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <RatingFormClient order={order} scenario={scenario} />
      </div>
    </Layout>
  );
}