import type { Metadata } from "next";
import RecurringDetailClient from "@/components/supplier/recurring/RecurringDetailClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Detail Jadwal | Wesup",
  description: "Detail jadwal postingan otomatis Wesup.",
};

export default async function RecurringDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecurringDetailClient key={id} configId={id} />;
}
