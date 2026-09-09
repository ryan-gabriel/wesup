"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, History, Send } from "lucide-react";
import { useToast } from "@/components/ui/GlobalToast";
import FileUploadPreview from "@/components/ui/FileUploadPreview";

// UI-only mock: batch → enrolled UMKM for the form dropdown.
// Real data would come from a backend query of registrations/payments.
const BATCH_UMKM_MOCKS: { batchId: string; umkms: { id: string; name: string }[] }[] = [
  {
    batchId: "batch-paid-001",
    umkms: [
      { id: "umkm-003", name: "Toko Sembako Jaya" },
      { id: "umkm-004", name: "Rumah Makan Sederhana" },
      { id: "umkm-005", name: "Katering Padang Makmur" },
      { id: "umkm-006", name: "Warung Bu Ani" },
    ],
  },
  {
    batchId: "batch-active-001",
    umkms: [
      { id: "umkm-001", name: "Catering Enak" },
      { id: "umkm-002", name: "Kopi Senja" },
      { id: "umkm-003", name: "Toko Sembako Jaya" },
    ],
  },
  {
    batchId: "batch-cancelled-001",
    umkms: [{ id: "umkm-001", name: "Catering Enak" }],
  },
];

const BATCH_OPTIONS = [
  { id: "batch-paid-001", title: "Ikan Nila Segar", code: "BATCH-20260825-003" },
  { id: "batch-active-001", title: "Kentang Granola Segar", code: "BATCH-20260825-002" },
  { id: "batch-cancelled-001", title: "Tahu Sumedang 50 pcs", code: "BATCH-20260820-005" },
];

interface FormErrors {
  batchId?: string;
  umkmId?: string;
  description?: string;
  photos?: string;
}

export default function ReportFormClient() {
  const { toast } = useToast();
  const [batchId, setBatchId] = useState("");
  const [umkmId, setUmkmId] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const selectedBatch = BATCH_OPTIONS.find((b) => b.id === batchId);
  const umkms = BATCH_UMKM_MOCKS.find((b) => b.batchId === batchId)?.umkms ?? [];

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!batchId) next.batchId = "Pilih penawaran batch terkait.";
    if (!umkmId) next.umkmId = "Pilih UMKM yang dilaporkan.";
    if (description.trim().length < 20)
      next.description = "Jelaskan masalah minimal 20 karakter.";
    if (photos.length === 0)
      next.photos = "Lampirkan minimal satu foto bukti.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) {
      toast("Periksa kembali isian form laporan.", "warning");
      return;
    }
    setSubmitting(true);
    // UI-only: simulate submit, no backend.
    window.setTimeout(() => {
      setSubmitting(false);
      toast("Laporan berhasil dikirim ke tim verifikasi Wesup.", "success");
      setBatchId("");
      setUmkmId("");
      setDescription("");
      setPhotos([]);
      setErrors({});
    }, 900);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Lapor UMKM Bermasalah
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <AlertTriangle size={16} className="text-amber-600" aria-hidden="true" />
            Dana escrow terkait akan dibekukan hingga keputusan tim verifikasi.
          </p>
        </div>
        <Link
          href="/supplier/akun/laporan/riwayat"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <History aria-hidden="true" size={18} />
          Riwayat Laporan
        </Link>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        noValidate
      >
        {/* Batch */}
        <div>
          <label htmlFor="report-batch" className="block text-sm font-semibold text-slate-800">
            Penawaran Batch
          </label>
          <select
            id="report-batch"
            value={batchId}
            onChange={(e) => {
              setBatchId(e.target.value);
              setUmkmId("");
            }}
            className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
              errors.batchId ? "border-red-300" : "border-slate-300"
            }`}
          >
            <option value="">Pilih batch</option>
            {BATCH_OPTIONS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} · {b.code}
              </option>
            ))}
          </select>
          {errors.batchId && (
            <p className="mt-1 text-xs font-medium text-red-600" role="alert">
              {errors.batchId}
            </p>
          )}
        </div>

        {/* UMKM */}
        <div>
          <label htmlFor="report-umkm" className="block text-sm font-semibold text-slate-800">
            UMKM yang Dilaporkan
          </label>
          <select
            id="report-umkm"
            value={umkmId}
            onChange={(e) => setUmkmId(e.target.value)}
            disabled={!batchId}
            className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
              errors.umkmId ? "border-red-300" : "border-slate-300"
            }`}
          >
            <option value="">{batchId ? "Pilih UMKM" : "Pilih batch terlebih dahulu"}</option>
            {umkms.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {errors.umkmId && (
            <p className="mt-1 text-xs font-medium text-red-600" role="alert">
              {errors.umkmId}
            </p>
          )}
          {!batchId && umkms.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {selectedBatch ? "Belum ada UMKM terdaftar pada batch ini." : ""}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="report-desc" className="block text-sm font-semibold text-slate-800">
            Deskripsi Masalah
          </label>
          <textarea
            id="report-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Jelaskan secara rinci pelanggaran atau masalah yang dilakukan UMKM…"
            className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
              errors.description ? "border-red-300" : "border-slate-300"
            }`}
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.description ? (
              <p className="text-xs font-medium text-red-600" role="alert">
                {errors.description}
              </p>
            ) : (
              <span />
            )}
            <span className="text-xs text-slate-400">{description.length} karakter</span>
          </div>
        </div>

        {/* Photos */}
        <div>
          <span className="block text-sm font-semibold text-slate-800">Foto Bukti</span>
          <FileUploadPreview
            files={photos}
            onChange={setPhotos}
            maxFiles={4}
            label="Unggah foto bukti"
            description="JPEG, PNG, atau WebP · maks 10 MB per file · maks 4 file"
            error={errors.photos}
          />
        </div>
      </form>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/supplier/akun/laporan/riwayat"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Batal
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        >
          <Send aria-hidden="true" size={18} />
          {submitting ? "Mengirim…" : "Kirim Laporan"}
        </button>
      </div>
    </div>
  );
}
