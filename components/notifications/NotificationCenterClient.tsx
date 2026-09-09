"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { NOTIFICATION_MOCKS, NOTIFICATION_TYPE_META } from "@/lib/notifications/mock-data";
import type { AppNotification } from "@/lib/notifications/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/SkeletonLoading";

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export default function NotificationCenterClient() {
  const [notifications, setNotifications] = useState(NOTIFICATION_MOCKS);
  const [loading] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  const markAllRead = () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary + mark-all-read */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
          <SummaryCard
            icon={<Bell className="text-blue-600" size={20} />}
            iconBg="bg-blue-100"
            label="Total"
            value={String(notifications.length)}
          />
          <SummaryCard
            icon={<Bell className="text-amber-600" size={20} />}
            iconBg="bg-amber-100"
            label="Belum dibaca"
            value={String(unreadCount)}
          />
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Tandai semua dibaca
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
            <Check className="h-4 w-4" aria-hidden="true" />
            Semua sudah dibaca
          </span>
        )}
      </section>

      {/* Feed */}
      {notifications.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white shadow-sm">
          <EmptyState
            heading="Tidak ada notifikasi"
            description="Ketika ada pembaruan aktivitas, notifikasi akan muncul di sini."
          />
        </section>
      ) : (
        <section aria-label="Notifikasi" className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </section>
      )}
    </div>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const meta = NOTIFICATION_TYPE_META[notification.type];
  const isUnread = !notification.readAt;

  const content = (
    <div className="flex gap-3">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.className}`}>
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`text-sm leading-snug ${isUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                {notification.title}
              </h3>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
                {meta.label}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-600">{notification.message}</p>
          </div>
          {isUnread && (
            <span aria-label="Belum dibaca" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400">{dates.format(new Date(notification.createdAt))}</p>
      </div>
    </div>
  );

  if (notification.href) {
    return (
      <Link
        href={notification.href}
        className="block p-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        {content}
      </Link>
    );
  }

  return <div className="p-4">{content}</div>;
}

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className="truncate text-lg font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}