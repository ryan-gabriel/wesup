"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { compressImage } from "@/lib/image-compression";
import type { AccountOrder } from "@/lib/orders/types";
import type {
  ComplaintCategory,
  ComplaintScenario,
} from "@/lib/dispute/types";
import { cn } from "@/lib/utils";
import FileUploadPreview from "@/components/ui/FileUploadPreview";
import EscrowCountdown from "./EscrowCountdown";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const CATEGORY_OPTIONS: { value: ComplaintCategory; label: string; hint: string }[] = [
  { value: "cacat", label: "Barang cacat", hint: "Barang rusak, pecah, atau kondisi fisik tidak sesuai." },
  { value: "busuk", label: "Barang busuk", hint: "Bahan pangan sudah tidak layak konsumsi." },
];

interface SubmitState {
  phase: "idle" | "compressing" | "done";
  message?: string;
}

export default function ComplaintFormClient({
  order,
  scenario,
}: {
  order: AccountOrder;
  scenario: ComplaintScenario | null;
}) {
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<SubmitState>({ phase: "idle" });

  const windowOpen = scenario?.kind === "window_open";
  const alreadyFiled = scenario?.kind === "filed";
  const windowClosed = scenario?.kind === "window_closed";

  if (alreadyFiled) {
    return (
      <NoticePanel
        tone="info"
        icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
        title="Sengketa sudah diajukan"
        description="Pesanan ini sudah memiliki tiket sengketa. Dana escrow dibekukan menunggu keputusan Admin."
        action={
          <Link
            href={`/pesanan/${order.id}/sengketa`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Lacak Status Sengketa
          </Link>
        }
      />
    );
  }

  if (windowClosed) {
    return (
      <div className="space-y-6">
        <OrderHeader order={order} />
        <NoticePanel
          tone="danger"
          icon={<AlertTriangle aria-hidden="true" className="h-5 w-5" />}
          title="Jendela komplain telah ditutup"
          description="Batas maksimal 1×24 jam sejak status Sudah Diambil telah lewat. Dana escrow telah cair otomatis ke Supplier, komplain bersifat ditolak permanen."
        />
      </div>
    );
  }

  if (!windowOpen) {
    return (
      <div className="space-y-6">
        <OrderHeader order={order} />
        <NoticePanel
          tone="muted"
          icon={<ShieldAlert aria-hidden="true" className="h-5 w-5" />}
          title="Komplain tidak tersedia"
          description="Fitur komplain hanya dapat dibuka untuk pesanan berstatus Sudah Diambil dalam batas waktu 1×24 jam."
        />
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!category) {
      setFormError("Pilih jenis komplain terlebih dahulu.");
      return;
    }
    if (files.length === 0) {
      setFormError("Unggah minimal 1 foto bukti kondisi barang.");
      return;
    }

    setSubmission({ phase: "compressing" });

    let successCount = 0;
    for (const file of files) {
      try {
        await compressImage(file, { outputType: "image/webp" });
        successCount += 1;
      } catch {
        // Pengiriman statis tetap dilanjutkan meski kompresi gagal.
      }
    }

    setSubmission({
      phase: "done",
      message:
        successCount === files.length
          ? "Semua foto bukti berhasil divalidasi dan dikompresi secara asinkron (non-blocking)."
          : "Foto bukti diterima untuk ditinjau.",
    });
  };

  return (
    <div className="space-y-6">
      <OrderHeader order={order} />

      {submission.phase === "done" ? (
        <SuccessPanel order={order} message={submission.message} />
      ) : (
        <>
          <EscrowBanner order={order} deadlineAt={scenario.deadlineAt} />

          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <fieldset>
              <legend className="text-sm font-bold uppercase tracking-wide text-slate-700">
                Jenis komplain
              </legend>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CATEGORY_OPTIONS.map((option) => {
                  const selected = category === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition",
                        selected
                          ? "border-red-300 bg-red-50 ring-1 ring-red-300"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <input
                        type="radio"
                        name="complaint-category"
                        value={option.value}
                        checked={selected}
                        onChange={() => setCategory(option.value)}
                        className="mt-0.5 h-4 w-4 accent-red-600"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {option.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="complaint-description"
                className="text-sm font-bold uppercase tracking-wide text-slate-700"
              >
                Deskripsi kondisi barang{" "}
                <span className="font-normal normal-case text-slate-400">(opsional)</span>
              </label>
              <textarea
                id="complaint-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Ceritakan apa yang Anda temukan saat barang diterima di titik kumpul."
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-700">
                Bukti foto kondisi barang
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Wajib minimal 1 foto. Foto dikompresi otomatis sebelum dikirim (maks 10 MB per file).
              </p>
              <div className="mt-3">
                <FileUploadPreview
                  files={files}
                  onChange={setFiles}
                  maxFiles={5}
                  label="Unggah foto bukti"
                  description="JPEG, PNG, atau WebP · maks 10 MB per file · kompresi otomatis"
                />
              </div>
            </div>

            {submission.phase === "compressing" && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Memvalidasi dan mengompresi foto bukti di perangkat Anda secara asinkron…
              </div>
            )}

            {formError && (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {formError}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/pesanan"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft aria-hidden="true" size={16} />
                Kembali ke Pesanan
              </Link>
              <button
                type="submit"
                disabled={submission.phase === "compressing"}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldAlert aria-hidden="true" size={16} />
                Ajukan Komplain & Bekukan Dana
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Dengan mengajukan komplain, dana escrow di-suspend hingga Admin (Arbiter) mengambil
              keputusan mutlak. Keputusan bersifat satu arah dan tidak dapat dibatalkan.
            </p>
          </form>
        </>
      )}
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
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600">
          <ShieldAlert aria-hidden="true" className="h-4 w-4" />
          Komplain Barang (Escrow)
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          {order.batchTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {order.counterparty} · <span className="font-mono">{order.batchDisplayCode}</span> ·{" "}
          {order.quantity} {order.unit} · {money.format(order.finalAmount)}
        </p>
      </header>
    </div>
  );
}

function EscrowBanner({
  order,
  deadlineAt,
}: {
  order: AccountOrder;
  deadlineAt: string;
}) {
  return (
    <section
      aria-label="Jendela komplain escrow"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShoppingBag aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Pesanan {order.batchTitle} Anda telah diambil.</p>
            <p className="mt-0.5 text-amber-800">
              Ajukan komplain dalam batas 1×24 jam sejak Sudah Diambil agar dana escrow dibekukan
              sebelum cair ke Supplier.
            </p>
          </div>
        </div>
        <EscrowCountdown deadlineAt={deadlineAt} />
      </div>
    </section>
  );
}

function SuccessPanel({
  order,
  message,
}: {
  order: AccountOrder;
  message?: string;
}) {
  return (
    <NoticePanel
      tone="success"
      icon={<CheckCircle2 aria-hidden="true" className="h-5 w-5" />}
      title="Komplain diterima — dana escrow dibekukan"
      description={`${message ?? ""} ${
        message ? " " : ""
      }Tiket sengketa masuk ke panel moderasi Admin (Arbiter). Dana ${money.format(
        order.finalAmount,
      )} ditahan dan timer auto-release dihentikan hingga keputusan keluar.`}
      action={
        <Link
          href="/pesanan"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          Kembali ke Pesanan
        </Link>
      }
    />
  );
}

function NoticePanel({
  tone,
  icon,
  title,
  description,
  action,
}: {
  tone: "info" | "danger" | "success" | "muted";
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const toneStyles: Record<string, string> = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    muted: "border-slate-200 bg-white text-slate-700",
  };
  return (
    <section className={cn("rounded-xl border p-5 shadow-sm", toneStyles[tone])}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/70">
          {icon}
        </span>
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed">{description}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </section>
  );
}