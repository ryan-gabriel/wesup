import SupplierBatchDetailClient from "@/components/supplier-batch/SupplierBatchDetailClient";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierBatchDetailClient key={id} batchId={id} />;
}
