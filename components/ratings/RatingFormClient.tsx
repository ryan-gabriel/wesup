"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  Star,
  StarOff,
  ThumbsUp,
} from "lucide-react";
import type { AccountOrder } from "@/lib/orders/types";
import type {
  RatingScenario,
  RatingScore,
} from "@/lib/ratings/types";
import { cn } from "@/lib/utils";

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

const STAR_SCORES: RatingScore[] = [1, 2, 3, 4, 5];

const SCORE_HINTS: Record<RatingScore, string> = {
  1: "Sangat buruk",
  2: "Buruk",
  3: "Cukup",
  4: "Baik",
  5: "Sangat baik",
};

function scoreHint(score: RatingScore): string {
  return `${score} bintang — ${SCORE_HINTS[score]}`;
}

export default function RatingFormClient({
  order,
  scenario,
}: {
  order: AccountOrder;
  scenario: RatingScenario;
}) {
  const [score, setScore] = useState<RatingScore | null>(null);
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // validasi
  switch (scenario.kind) {
    case "already_rated":
      return <AlreadyRatedPanel order={order} score={scenario.rating.score} comment={scenario.rating.comment} createdAt={scenario.rating.createdAt} />;
    case "blocked_no_show":
      return (
        <div className="space-y-6">
          <OrderHeader order={order} />
          <NoticePanel
            tone="danger"
            icon={<StarOff aria-hidden="true" className="h-5 w-5" />}
            title="Rating diblokir"
            description="Transaksi ini diakhiri dengan status Tidak Hadir (No-Show), sehingga akses memberikan penilaian diblokir secara mutlak."
          />
        </div>
      );
    case "locked_pre_pickup":
      return (
        <div className="space-y-6">
          <OrderHeader order={order} />
          <NoticePanel
            tone="muted"
            icon={<Lock aria-hidden="true" className="h-5 w-5" />}
            title="Belum bisa menilai"
            description="Kolom rating terkunci hingga serah terima fisik selesai. Form penilaian hanya dirender setelah pesanan berstatus Sudah Diambil."
          />
        </div>
      );
    case "unlocked":
      break;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!score) {
      setFormError("Pilih rating bintang 1 sampai 5 terlebih dahulu.");
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        <OrderHeader order={order} />
        <NoticePanel
          tone="success"
          icon={<CheckCircle2 aria-hidden="true" className="h-5 w-5" />}
          title="Penilaian berhasil dikirim"
          description={`Terima kasih! Penilaian ${scoreHint(score as RatingScore)} untuk ${order.counterparty} sudah tercatat. Penilaian hanya dapat diberikan sekali per transaksi.`}
          action={
            <Link
              href="/pesanan"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Kembali ke Pesanan
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OrderHeader order={order} />

      <section
        aria-label="Informasi transaksi"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
      >
        <span>
          Batch: <strong className="text-slate-900">{order.batchTitle}</strong>
        </span>
        <span className="font-mono text-xs text-slate-400">{order.batchDisplayCode}</span>
        <span>
          Qty: <strong className="text-slate-900">{order.quantity} {order.unit}</strong>
        </span>
        <span>
          Total: <strong className="text-slate-900">{money.format(order.finalAmount)}</strong>
        </span>
      </section>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <fieldset>
          <legend className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Berikan rating bintang
          </legend>
          <p className="mt-1 text-xs text-slate-500">
            Seberapa puas Anda dengan kualitas pelayanan {order.counterparty}? (1 = sangat buruk, 5 = sangat baik)
          </p>
          <div className="mt-3 flex items-center gap-1">
            {STAR_SCORES.map((value) => {
              const selected = score === value;
              const filled = selected;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setScore(value);
                    setFormError(null);
                  }}
                  aria-pressed={selected}
                  aria-label={scoreHint(value)}
                  title={SCORE_HINTS[value]}
                  className={cn(
                    "rounded-lg p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                    selected ? "text-amber-500" : "text-slate-300 hover:text-amber-400",
                  )}
                >
                  <Star
                    aria-hidden="true"
                    className="h-8 w-8"
                    fill={filled ? "currentColor" : "none"}
                  />
                </button>
              );
            })}
          </div>
          <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm font-semibold text-amber-600">
            {score ? scoreHint(score) : "Belum ada bintang dipilih"}
          </p>
        </fieldset>

        <div>
          <label
            htmlFor="rating-comment"
            className="text-sm font-bold uppercase tracking-wide text-slate-700"
          >
            Ulasan untuk {order.counterparty}{" "}
            <span className="font-normal normal-case text-slate-400">(opsional)</span>
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Ceritakan pengalaman Anda mengenai kualitas produk dan pelayanan di titik kumpul.
          </p>
          <textarea
            id="rating-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            placeholder="Contoh: barang segar, antrean cepat, dan petugas ramah."
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

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
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
          >
            <ThumbsUp aria-hidden="true" size={16} />
            Kirim Penilaian
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Penilaian hanya dapat diberikan sekali per transaksi dan tidak dapat diubah setelah dikirim.
        </p>
      </form>
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
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600">
          <Star aria-hidden="true" className="h-4 w-4 fill-current" />
          Penilaian &amp; Ulasan
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          {order.batchTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {order.counterparty} · <span className="font-mono">{order.batchDisplayCode}</span> ·{" "}
          {order.quantity} {order.unit}
        </p>
      </header>
    </div>
  );
}

function AlreadyRatedPanel({
  order,
  score,
  comment,
  createdAt,
}: {
  order: AccountOrder;
  score: RatingScore;
  comment: string | null;
  createdAt: string;
}) {
  return (
    <div className="space-y-6">
      <OrderHeader order={order} />
      <NoticePanel
        tone="success"
        icon={<ThumbsUp aria-hidden="true" className="h-5 w-5" />}
        title="Penilaian Anda sudah tercatat"
        description="Satu transaksi hanya dapat dinilai satu kali. Berikut ringkasan penilaian yang sudah Anda kirim."
      />
      <section
        aria-label="Ringkasan penilaian Anda"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-0.5">
            {STAR_SCORES.map((value) => (
              <Star
                key={value}
                aria-hidden="true"
                className={value <= score ? "h-6 w-6 text-amber-500" : "h-6 w-6 text-slate-200"}
                fill={value <= score ? "currentColor" : "none"}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400">
            {dates.format(new Date(createdAt))}
          </p>
        </div>
        {comment && (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {comment}
          </p>
        )}
      </section>
      <Link
        href="/pesanan"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Kembali ke Pesanan
      </Link>
    </div>
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