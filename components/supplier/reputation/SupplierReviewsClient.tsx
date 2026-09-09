"use client";

import Link from "next/link";
import { ArrowLeft, MessageSquareQuote, Star } from "lucide-react";
import {
  ratingBarsFor,
  recentRatingNotes,
} from "@/lib/supplier-ratings/mock-data";
import type { SupplierRatings } from "@/lib/supplier-ratings/types";
import { cn } from "@/lib/utils";

const FULL_STARS = [1, 2, 3, 4, 5];

function formatAverage(average: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);
}

function filledStars(average: number): number {
  return Math.round(average);
}

const dates = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

export default function SupplierReviewsClient({
  ratings,
}: {
  ratings: SupplierRatings;
}) {
  const bars = ratingBarsFor(ratings);
  const recent = recentRatingNotes(ratings);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/supplier"
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Dasbor Pemasok
        </Link>
        <header className="mt-3">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600">
            <Star aria-hidden="true" className="h-4 w-4 fill-current" />
            Penilaian &amp; Ulasan
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            {ratings.supplierName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Reputasi dibangun dari penilaian UMKM pasca serah terima fisik.
          </p>
        </header>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-4xl font-extrabold text-slate-900">
            {formatAverage(ratings.average)}
          </p>
          <div className="mt-2 flex justify-center gap-0.5" aria-label={`Rating rata-rata ${formatAverage(ratings.average)} dari 5`}>
            {FULL_STARS.map((value) => (
              <Star
                key={value}
                aria-hidden="true"
                className={cn(
                  "h-5 w-5",
                  value <= filledStars(ratings.average)
                    ? "text-amber-500"
                    : "text-slate-200",
                )}
                fill={value <= filledStars(ratings.average) ? "currentColor" : "none"}
              />
            ))}
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {ratings.total} ulasan
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Median masih dikunci escrow — rating baru muncul setelah verifikasi
            admin.
          </p>
        </div>

        <div
          role="group"
          aria-label="Rincian per bintang"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2"
        >
          <ol className="space-y-2.5">
            {bars.map((bar) => (
              <li
                key={bar.score}
                aria-label={`${bar.score} bintang`}
                className="flex items-center gap-3"
              >
                <span className="flex w-16 shrink-0 items-center gap-1 text-sm font-semibold text-slate-700">
                  <Star aria-hidden="true" className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {bar.score}
                </span>
                <span
                  aria-hidden="true"
                  className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"
                >
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${bar.pct}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right text-xs font-medium text-slate-500">
                  {bar.count}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="recent-reviews-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="recent-reviews-heading"
            className="flex items-center gap-2 text-lg font-bold text-slate-900"
          >
            <MessageSquareQuote aria-hidden="true" className="h-5 w-5 text-amber-500" />
            Ulasan Terbaru
          </h2>
        </div>

        {recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Belum ada ulasan dari pembeli untuk supplier ini.
          </p>
        ) : (
          <ul className="space-y-3">
            {recent.map((note) => (
              <li
                key={`${note.buyerName}-${note.createdAt}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{note.buyerName}</p>
                  <div className="flex items-center gap-2">
                    <span className="flex gap-0.5" aria-label={`${note.score} bintang`}>
                      {FULL_STARS.map((value) => (
                        <Star
                          key={value}
                          aria-hidden="true"
                          className={cn(
                            "h-4 w-4",
                            value <= note.score ? "text-amber-500" : "text-slate-200",
                          )}
                          fill={value <= note.score ? "currentColor" : "none"}
                        />
                      ))}
                    </span>
                    <span className="text-xs text-slate-400">
                      {dates.format(new Date(note.createdAt))}
                    </span>
                  </div>
                </div>
                {note.comment && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {note.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}