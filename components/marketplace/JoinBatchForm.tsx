"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { readApiError } from "@/lib/marketplace/api-repository";
import type { MarketplaceItem } from "@/lib/marketplace/types";

interface ViewerLocation {
  latitude: number;
  longitude: number;
}

interface RegistrationResult {
  count: number;
  registrationId: string;
}

export interface JoinBatchFormProps {
  item: MarketplaceItem;
  consentGiven: boolean;
  viewerLocation?: ViewerLocation | null;
  onSuccess: (result: RegistrationResult) => void;
}

export default function JoinBatchForm({
  item,
  consentGiven,
  viewerLocation = null,
  onSuccess,
}: JoinBatchFormProps) {
  const [quantity, setQuantity] = useState<number | "">(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consentGiven || submitting) return;

    if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0) {
      setError("Masukkan jumlah porsi yang valid.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/registrations", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchId: item.id,
          quantity,
          consentLat: viewerLocation?.latitude ?? null,
          consentLng: viewerLocation?.longitude ?? null,
        }),
      });

      if (!response.ok) throw new Error(await readApiError(response));
      const result = (await response.json()) as Partial<RegistrationResult>;
      if (
        typeof result.count !== "number" ||
        typeof result.registrationId !== "string" ||
        result.registrationId.length === 0
      ) {
        throw new Error("Respons pendaftaran tidak valid.");
      }

      setSucceeded(true);
      onSuccess({ count: result.count, registrationId: result.registrationId });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Pendaftaran gagal. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (succeeded) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4" role="status">
        <p className="font-semibold text-emerald-800">Pendaftaran berhasil.</p>
        <p className="text-sm text-emerald-700">
          Selesaikan pembayaran sebelum batas waktu agar slot tetap tersimpan.
        </p>
        <Link
          href="/pesanan"
          className="inline-flex w-fit items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          Lihat Pesanan
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="join-batch-quantity" className="text-sm font-semibold text-slate-700">
          Jumlah porsi
        </label>
        <input
          id="join-batch-quantity"
          name="quantity"
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(event) => {
            const raw = event.target.value;
            setQuantity(raw === "" ? "" : Number(raw));
          }}
          disabled={submitting}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!consentGiven || submitting}
        className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
          consentGiven && !submitting
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "cursor-not-allowed bg-slate-200 text-slate-500"
        }`}
      >
        {submitting ? "Mendaftarkan…" : "Daftar Sekarang"}
      </button>

      {!consentGiven ? (
        <p className="text-xs font-medium text-slate-500">
          Centang persetujuan lokasi pengambilan untuk mengaktifkan tombol daftar.
        </p>
      ) : null}
    </form>
  );
}
