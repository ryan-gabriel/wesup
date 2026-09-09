"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { supplierBatchApiRepository } from "@/lib/supplier-catalog/api-repository";
import type { SupplierBatchDetail, SupplierBatchStatus } from "@/lib/supplier-batch/types";
import type { CatalogDraft } from "@/lib/supplier-catalog/types";
import { isTierSchemeLocked } from "@/lib/supplier-catalog/lock";
import CreateCatalogForm from "@/components/supplier/catalog/CreateCatalogForm";

function batchToDraft(batch: SupplierBatchDetail): CatalogDraft {
  return {
    title: batch.title,
    category: batch.category,
    description: batch.description,
    targetQuantity: batch.targetQuantity,
    productPhoto: null,
    productPhotoUrl: batch.imageUrl.startsWith("http") ? batch.imageUrl : null,
    tiers: batch.tiers.map((t) => ({
      tierNumber: t.tierNumber,
      minimumQuantity: t.minimumQuantity,
      maximumQuantity: t.maximumQuantity,
      pricePerUnit: t.pricePerUnit,
    })),
    registrationOpensAt: batch.timeline.registrationOpensAt.slice(0, 16),
    registrationClosesAt: batch.timeline.registrationClosesAt.slice(0, 16),
    paymentOpensAt: batch.timeline.paymentOpensAt.slice(0, 16),
    paymentClosesAt: batch.timeline.paymentClosesAt.slice(0, 16),
    estimatedReadyAt: batch.timeline.estimatedReadyAt.slice(0, 16),
    pickupName: batch.pickup.name,
    pickupAddress: batch.pickup.address,
    pickupLatitude: batch.pickup.latitude,
    pickupLongitude: batch.pickup.longitude,
    recurring: {
      enabled: false,
      name: "",
      intervalDays: 7,
      daysOfWeek: [],
    },
  };
}

type LoadPhase = "idle" | "loading" | "success" | "error" | "not-found" | "read-only";

const readOnlyStatusLabel: Partial<Record<SupplierBatchStatus, string>> = {
  CLOSED: "Selesai",
  CANCELLED_BY_SUPPLIER: "Dibatalkan pemasok",
  TAKEDOWN: "Diturunkan Admin",
  COMPLETED: "Selesai",
};

export default function EditCatalogForm() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const batchId = params.id;

  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [initialDraft, setInitialDraft] = useState<CatalogDraft | null>(null);
  const [batchStatus, setBatchStatus] = useState<SupplierBatchStatus | null>(null);
  const [locationLocked, setLocationLocked] = useState(false);
  const [tiersLocked, setTiersLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    supplierBatchApiRepository
      .getById(batchId, { signal: controller.signal })
      .then((batch) => {
        if (!batch) {
          setPhase("not-found");
          return;
        }
        if (batch.status !== "DRAFT" && batch.status !== "PUBLISHED") {
          setError(`${readOnlyStatusLabel[batch.status] ?? "Katalog"} tidak dapat diedit.`);
          setPhase("read-only");
          return;
        }
        setInitialDraft(batchToDraft(batch));
        setBatchStatus(batch.status);
        setLocationLocked(batch.participantCount > 0);
        setTiersLocked(isTierSchemeLocked(batch.participantCount));
        setPhase("success");
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Gagal memuat data katalog.");
        setPhase("error");
      });

    return () => controller.abort();
  }, [batchId]);

  if (phase === "loading") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-blue-500" />
        <p className="mt-3 text-sm text-slate-600">Memuat data katalog...</p>
      </div>
    );
  }

  if (phase === "not-found") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Katalog tidak ditemukan</h2>
        <p className="mt-2 text-sm text-slate-600">ID katalog: {batchId}</p>
        <Link
          href="/supplier/catalog"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          <ArrowLeft size={16} />
          Kembali ke daftar katalog
        </Link>
      </div>
    );
  }

  if (phase === "read-only") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto h-6 w-6 text-slate-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Katalog hanya dapat dibaca</h2>
        <p className="mt-2 text-sm text-slate-600">{error ?? "Status katalog ini tidak mengizinkan perubahan."}</p>
        <Link
          href={`/supplier/batch/${batchId}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <ArrowLeft size={16} />
          Kembali ke detail katalog
        </Link>
      </div>
    );
  }

  if (phase === "error" || !initialDraft) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto h-6 w-6 text-red-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">Gagal memuat katalog</h2>
        <p className="mt-1 text-sm text-red-600">{error ?? "Terjadi kesalahan."}</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/supplier/batch/${batchId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} />
          Kembali ke detail katalog
        </Link>
      </div>

      {/* Location lock notice */}
      {locationLocked && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-orange-600" />
          <div className="text-sm text-orange-800">
            <p className="font-semibold">Lokasi terkunci</p>
            <p className="mt-1">
              Penawaran ini sudah memiliki peserta terdaftar. Lokasi pengambilan tidak dapat diubah. Detail lainnya tetap bisa diedit.
            </p>
          </div>
        </div>
      )}

      {/* Tier lock notice */}
      {tiersLocked && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-orange-600" />
          <div className="text-sm text-orange-800">
            <p className="font-semibold">Skema harga terkunci</p>
            <p className="mt-1">
              Penawaran ini sudah memiliki peserta terdaftar. Skema harga tier tidak dapat diubah. Buat penawaran baru jika ingin mengubah harga.
            </p>
          </div>
        </div>
      )}

      <CreateCatalogForm
        initialDraft={initialDraft}
        batchId={batchId}
        submitAction={batchStatus === "DRAFT" ? "publish" : "draft"}
        locationLocked={locationLocked}
        tiersLocked={tiersLocked}
        productPhotoRequired={false}
        submitLabel={batchStatus === "DRAFT" ? "Terbitkan Penawaran" : "Simpan Perubahan"}
      />
    </>
  );
}
