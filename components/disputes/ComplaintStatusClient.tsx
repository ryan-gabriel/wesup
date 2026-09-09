"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Circle,
  Clock3,
  FileImage,
  Landmark,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  Wallet,
} from "lucide-react";
import type { AccountOrder } from "@/lib/orders/types";
import type {
  ComplaintScenario,
  DisputeRecord,
  DisputeStatus,
  RefundStatus,
  RefundTicket,
} from "@/lib/dispute/types";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dates.format(date);
}

function maskAccountNumber(number: string): string {
  const visible = number.slice(-4);
  return `•••• ${visible}`;
}

export default function ComplaintStatusClient({
  order,
  scenario,
}: {
  order: AccountOrder;
  scenario: ComplaintScenario | null;
}) {
  if (scenario?.kind !== "filed") {
    return (
      <div className="space-y-6">
        <OrderHeader order={order} />
        {scenario?.kind === "window_open" ? (
          <EmptyStatusCard
            order={order}
            title="Belum ada komplain diajukan"
            description="Tidak ada tiket sengketa untuk pesanan ini. Anda masih berada dalam jendela komplain 1×24 jam."
            showAction
          />
        ) : (
          <EmptyStatusCard
            order={order}
            title="Jendela komplain telah berlalu"
            description="Batas 1×24 jam sejak Sudah Diambil telah lewat tanpa komplain. Dana escrow telah cair otomatis ke Supplier."
          />
        )}
      </div>
    );
  }

  const { dispute, refund } = scenario;

  return (
    <div className="space-y-6">
      <OrderHeader order={order} />

      <EscrowBanner dispute={dispute} />

      <TimelineCard dispute={dispute} />

      <DisputeDetailCard dispute={dispute} />

      {refund && <RefundCard order={order} refund={refund} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/pesanan/${order.id}/serah-terima`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Detail Serah Terima
        </Link>
        <Link
          href="/pesanan"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Kembali ke Pesanan
        </Link>
      </div>
    </div>
  );
}

function OrderHeader({ order }: { order: AccountOrder }) {
  return (
    <div>
      <Link
        href="/pesanan"
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Pesanan
      </Link>
      <header className="mt-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          Lacak Sengketa Escrow
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          {order.batchTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {order.counterparty} ·{" "}
          <span className="font-mono">{order.batchDisplayCode}</span> ·{" "}
          {order.quantity} {order.unit} · {money.format(order.finalAmount)}
        </p>
      </header>
    </div>
  );
}

const ESCROW_PANELS: Record<
  DisputeRecord["escrowStatus"],
  { title: string; description: string; className: string; icon: React.ReactNode }
> = {
  frozen: {
    title: "Dana Dibekukan (Escrow Suspended)",
    description:
      "Timer auto-release escrow 1×24 jam dihentikan sejak komplain diterima. Dana tidak akan cair otomatis ke Supplier hingga Admin (Arbiter) memberikan keputusan.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
    icon: <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />,
  },
  refunded: {
    title: "Dana Dikembalikan ke UMKM",
    description:
      "Arbiter memutuskan sengketa dimenangkan UMKM. Dana siap dikembalikan penuh melalui antrean refund manual.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: <Wallet className="h-5 w-5 text-emerald-600" aria-hidden="true" />,
  },
  released: {
    title: "Dana Dirilis ke Supplier",
    description:
      "Arbiter menolak komplain dan dana escrow dirilis ke Supplier. Siklus transaksi dinyatakan selesai.",
    className: "border-slate-200 bg-white text-slate-700",
    icon: <TimerReset className="h-5 w-5 text-slate-500" aria-hidden="true" />,
  },
};

function EscrowBanner({ dispute }: { dispute: DisputeRecord }) {
  const panel = ESCROW_PANELS[dispute.escrowStatus];
  return (
    <section
      aria-label="Status dana escrow"
      className={cn("rounded-xl border p-5 shadow-sm", panel.className)}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70">
          {panel.icon}
        </span>
        <div>
          <h2 className="font-bold">{panel.title}</h2>
          <p className="mt-1 text-sm leading-relaxed">{panel.description}</p>
        </div>
      </div>
    </section>
  );
}

const TIMELINE: { key: DisputeStatus; label: string; description: string }[] = [
  {
    key: "pending",
    label: "Komplain diajukan",
    description: "Bukti foto diterima dan dana escrow dibekukan.",
  },
  {
    key: "under_review",
    label: "Ditinjau Arbiter",
    description:
      "Admin membandingkan bukti foto dengan rekam jejak persetujuan lokasi.",
  },
  {
    key: "resolved_supplier",
    label: "Keputusan: Dana ke Supplier",
    description: "Komplain ditolak, dana dirilis ke Supplier.",
  },
  {
    key: "resolved_umkm",
    label: "Keputusan: Full Refund ke UMKM",
    description: "Komplain dimenangkan UMKM, dana dikembalikan.",
  },
];

function statusStepIndex(status: DisputeStatus): number {
  switch (status) {
    case "pending":
      return 0;
    case "under_review":
      return 1;
    default:
      return 2;
  }
}

function TimelineCard({ dispute }: { dispute: DisputeRecord }) {
  const activeStep = statusStepIndex(dispute.status);
  const resolved =
    dispute.status === "resolved_supplier" || dispute.status === "resolved_umkm";

  return (
    <section
      aria-label="Perjalanan sengketa"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
        <Clock3 aria-hidden="true" className="h-4 w-4 text-slate-400" />
        Perjalanan Sengketa
      </h2>
      <ol className="mt-4 space-y-0">
        {TIMELINE.map((step, index) => {
          const isDone = index < activeStep;
          const isActive = index === activeStep && !resolved;
          const isDecisionActive = resolved && index === 2;
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                    isDone || isDecisionActive
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : isActive
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-slate-300 bg-white text-slate-400",
                  )}
                >
                  {isDone || isDecisionActive ? (
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  ) : isActive ? (
                    <Clock3 aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Circle aria-hidden="true" className="h-4 w-4" />
                  )}
                </span>
                {index < TIMELINE.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-0.5 flex-1",
                      index < activeStep ? "bg-emerald-400" : "bg-slate-200",
                    )}
                  />
                )}
              </div>
              <div className="pb-6">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isDone || isDecisionActive || isActive
                      ? "text-slate-900"
                      : "text-slate-400",
                  )}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>
                {isActive && (
                  <p className="mt-1 text-xs font-medium text-blue-600">
                    Diajukan: {formatDate(dispute.createdAt)}
                  </p>
                )}
                {resolved && index === 2 && (
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Diputus: {formatDate(dispute.decidedAt)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const CATEGORY_LABEL: Record<DisputeRecord["complaintCategory"], string> = {
  cacat: "Barang cacat",
  busuk: "Barang busuk",
};

function DisputeDetailCard({ dispute }: { dispute: DisputeRecord }) {
  return (
    <section
      aria-label="Detail komplain"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
        <FileImage aria-hidden="true" className="h-4 w-4 text-slate-400" />
        Bukti Komplain
      </h2>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-slate-500">Jenis komplain</dt>
          <dd className="font-semibold text-slate-900">
            {CATEGORY_LABEL[dispute.complaintCategory]}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-slate-500">Tanggal diajukan</dt>
          <dd className="font-semibold text-slate-900">
            {formatDate(dispute.createdAt)}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="shrink-0 text-slate-500">Deskripsi</dt>
          <dd className="rounded-lg bg-slate-50 px-3 py-2 leading-relaxed text-slate-700">
            {dispute.description}
          </dd>
        </div>
      </dl>

      <PhotoGrid dispute={dispute} />

      {dispute.adminNotes && (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
          <p className="font-semibold text-blue-900">Catatan Arbiter</p>
          <p className="mt-0.5 text-blue-800">{dispute.adminNotes}</p>
        </div>
      )}
    </section>
  );
}

function PhotoGrid({ dispute }: { dispute: DisputeRecord }) {
  return (
    <ul
      className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
      role="list"
      aria-label="Foto bukti yang diunggah"
    >
      {dispute.photos.map((photo, index) => (
        <li
          key={`${photo.url}-${index}`}
          className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white shadow-sm">
            <FileImage aria-hidden="true" className="h-8 w-8 text-blue-400" />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-600">
            {photo.caption ?? `Bukti ${index + 1}`}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">
            {photo.url.split("/").pop()}
          </p>
        </li>
      ))}
    </ul>
  );
}

const REFUND_STATUS: Record<RefundStatus, { label: string; className: string }> = {
  pending: { label: "Menunggu Persetujuan", className: "bg-slate-100 text-slate-700" },
  waiting_bank_account: { label: "Menunggu Rekening", className: "bg-amber-100 text-amber-700" },
  processing: { label: "Refund Diproses", className: "bg-blue-100 text-blue-700" },
  completed: { label: "Refund Selesai", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Refund Gagal", className: "bg-red-100 text-red-700" },
};

function RefundCard({ order, refund }: { order: AccountOrder; refund: RefundTicket }) {
  const badge = REFUND_STATUS[refund.status];
  return (
    <section
      aria-label="Status pengembalian dana"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
          <Banknote aria-hidden="true" className="h-4 w-4 text-slate-400" />
          Pengembalian Dana (Refund Manual)
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            badge.className,
          )}
        >
          {badge.label}
        </span>
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-slate-500">Nominal refund</dt>
          <dd className="font-semibold text-slate-900">{money.format(refund.amount)}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-slate-500">Pemicu</dt>
          <dd className="font-semibold text-slate-900">
            {refund.trigger === "dispute_won" ? "Sengketa dimenangkan" : refund.trigger}
          </dd>
        </div>
        {refund.bankAccount ? (
          <div className="flex items-start justify-between gap-4">
            <dt className="text-slate-500">Rekening tujuan</dt>
            <dd className="font-semibold text-slate-900">
              {refund.bankAccount.bankName} ·{" "}
              {maskAccountNumber(refund.bankAccount.accountNumber)} ·{" "}
              {refund.bankAccount.accountHolderName}
            </dd>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            <Landmark aria-hidden="true" className="h-4 w-4 shrink-0" />
            Admin telah menyetujui refund. Lengkapi rekening agar dana dapat dikembalikan.
          </div>
        )}
      </dl>

      {refund.status === "waiting_bank_account" && !refund.bankAccount && (
        <Link
          href={`/pesanan/${order.id}/refund/rekening`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <Landmark aria-hidden="true" size={16} />
          Isi Rekening Manual
        </Link>
      )}
    </section>
  );
}

function EmptyStatusCard({
  order,
  title,
  description,
  showAction = false,
}: {
  order: AccountOrder;
  title: string;
  description: string;
  showAction?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        <ShieldAlert aria-hidden="true" className="h-6 w-6 text-blue-500" />
      </div>
      <h2 className="mt-3 font-bold text-slate-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>
      {showAction && (
        <Link
          href={`/pesanan/${order.id}/komplain`}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
        >
          <ShieldAlert aria-hidden="true" size={16} />
          Ajukan Komplain
        </Link>
      )}
    </section>
  );
}