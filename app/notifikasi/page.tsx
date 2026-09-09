import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import NotificationCenterClient from "@/components/notifications/NotificationCenterClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notifikasi | Wesup",
  description: "Pusat notifikasi dan pengingat aktivitas Anda di Wesup.",
};

export default function NotifikasiPage() {
  return (
    <Layout>
      <PageContainer>
        <PageHeader
          title="Notifikasi"
          description="Pengingat dan pembaruan aktivitas Anda di Wesup."
          icon={<Bell aria-hidden="true" className="w-6 h-6" />}
        />
        <NotificationCenterClient />
      </PageContainer>
    </Layout>
  );
}