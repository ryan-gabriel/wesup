import type { ReportStatus } from "@/lib/supplier-report/types";

const STATUS_META: Record<
  ReportStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Menunggu",
    className: "bg-slate-100 text-slate-700",
  },
  under_review: {
    label: "Diverifikasi",
    className: "bg-blue-100 text-blue-700",
  },
  resolved_supplier: {
    label: "Untuk Supplier",
    className: "bg-emerald-100 text-emerald-700",
  },
  resolved_umkm: {
    label: "Untuk UMKM",
    className: "bg-amber-100 text-amber-700",
  },
};

export interface ReportStatusBadgeProps {
  status: ReportStatus;
}

export default function ReportStatusBadge({ status }: ReportStatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
