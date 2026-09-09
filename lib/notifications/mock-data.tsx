import {
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserPlus,
  Ban,
  Megaphone,
  RefreshCcw,
} from "lucide-react";
import type { AppNotification, AppNotificationType } from "./types";

export const NOTIFICATION_TYPE_META: Record<
  AppNotificationType,
  { label: string; className: string; icon: React.ReactNode }
> = {
  payment_due: {
    label: "Tagihan",
    className: "bg-amber-100 text-amber-700",
    icon: <Clock className="h-4 w-4" aria-hidden="true" />,
  },
  payment_success: {
    label: "Pembayaran",
    className: "bg-emerald-100 text-emerald-700",
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  },
  pickup_ready: {
    label: "Siap Diambil",
    className: "bg-blue-100 text-blue-700",
    icon: <Bell className="h-4 w-4" aria-hidden="true" />,
  },
  dispute: {
    label: "Sengketa",
    className: "bg-red-100 text-red-700",
    icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
  },
  refund: {
    label: "Refund",
    className: "bg-violet-100 text-violet-700",
    icon: <RefreshCcw className="h-4 w-4" aria-hidden="true" />,
  },
  suspension: {
    label: "Peringatan",
    className: "bg-slate-100 text-slate-700",
    icon: <Ban className="h-4 w-4" aria-hidden="true" />,
  },
  referral: {
    label: "Referral",
    className: "bg-teal-100 text-teal-700",
    icon: <UserPlus className="h-4 w-4" aria-hidden="true" />,
  },
  batch_update: {
    label: "Batch",
    className: "bg-indigo-100 text-indigo-700",
    icon: <Megaphone className="h-4 w-4" aria-hidden="true" />,
  },
};

export const NOTIFICATION_MOCKS: readonly AppNotification[] = [
  {
    id: "ntf-001",
    type: "pickup_ready",
    title: "Pesanan siap diambil",
    message:
      "Pesanan Anda di batch 'Kentang Granola Segar' sudah lunas dan siap diambil di lokasi supplier sampai 25 Sep 2026.",
    createdAt: "2026-09-04T08:05:00.000Z",
    readAt: null,
    href: "/pesanan/ord-umkm-001/serah-terima",
  },
  {
    id: "ntf-002",
    type: "payment_due",
    title: "Segera bayar pesanan Anda",
    message:
      "Pesanan batch 'Ikan Nila Segar' belum dibayar. Batas pembayaran dalam 4 jam, setelah itu registrasi dibatalkan.",
    createdAt: "2026-09-04T07:00:00.000Z",
    readAt: null,
    href: "/pesanan",
  },
  {
    id: "ntf-003",
    type: "payment_success",
    title: "Pembayaran berhasil",
    message:
      "Pembayaran QRIS Rp1.140.000 untuk batch 'Kentang Granola Segar' diterima. Escrow aktif 1×24 jam setelah pengambilan.",
    createdAt: "2026-09-03T14:30:00.000Z",
    readAt: "2026-09-03T15:00:00.000Z",
    href: "/pesanan",
  },
  {
    id: "ntf-004",
    type: "batch_update",
    title: "Batch baru tersedia",
    message:
      "Supplier PT Agri Sejahtera membuka batch baru 'Tepung Terigu Premium' dengan tier diskon hingga 15%.",
    createdAt: "2026-09-02T09:00:00.000Z",
    readAt: "2026-09-02T10:00:00.000Z",
    href: "/marketplace",
  },
  {
    id: "ntf-005",
    type: "refund",
    title: "Refund diproses",
    message:
      "Dana refund Rp450.000 untuk batch 'Tahu Sumedang 50 pcs' sedang diproses ke rekening Anda.",
    createdAt: "2026-08-30T11:20:00.000Z",
    readAt: "2026-08-30T12:00:00.000Z",
    href: "/akun",
  },
];