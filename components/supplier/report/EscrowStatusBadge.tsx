type EscrowStatus = "held" | "released" | "refunded" | "forfeited";

const META: Record<EscrowStatus, { label: string; className: string }> = {
  held: {
    label: "Escrow Dibekukan",
    className: "bg-blue-100 text-blue-700",
  },
  released: {
    label: "Dana Ke Supplier",
    className: "bg-emerald-100 text-emerald-700",
  },
  refunded: {
    label: "Dana Dikembalikan",
    className: "bg-amber-100 text-amber-700",
  },
  forfeited: {
    label: "Dana Hangus",
    className: "bg-slate-200 text-slate-700",
  },
};

export interface EscrowStatusBadgeProps {
  status: EscrowStatus;
}

export default function EscrowStatusBadge({ status }: EscrowStatusBadgeProps) {
  const meta = META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
