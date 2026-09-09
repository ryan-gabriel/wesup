"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { compressImage, CompressionError } from "@/lib/image-compression";
import { validateRawImageInput } from "@/lib/supplier-registration/contracts";

type PhotoStatus = "idle" | "compressing" | "ready" | "error";

export interface BusinessPhotoFieldProps {
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  disabled?: boolean;
  variant?: "business" | "product";
  existingUrl?: string | null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSavings(originalSize: number, compressedSize: number): string {
  if (originalSize <= 0 || compressedSize >= originalSize) return "";
  return "Foto berhasil diunggah";
}

export default function BusinessPhotoField({
  value,
  onChange,
  error,
  disabled = false,
  variant = "business",
  existingUrl = null,
}: BusinessPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState<PhotoStatus>(value ? "ready" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(error);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(value?.size ?? null);
  const [dragActive, setDragActive] = useState(false);
  const isProduct = variant === "product";
  const uploadLabel = isProduct ? "Unggah foto produk" : "Unggah foto usaha";
  const uploadHint = isProduct
    ? "Foto produk diproses menjadi WebP secara otomatis"
    : "Foto diproses menjadi WebP secara otomatis";
  const previewAlt = isProduct ? "Pratinjau foto produk" : "Pratinjau foto tempat usaha";
  const errorId = isProduct ? "product-photo-error" : "business-photo-error";

  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function processFile(rawFile: File) {
    if (disabled) return;
    const metadataError = validateRawImageInput(rawFile);
    if (metadataError) {
      setStatus("error");
      setErrorMessage(metadataError);
      onChange(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestRef.current;
    setStatus("compressing");
    setErrorMessage(undefined);
    setOriginalSize(rawFile.size);
    setCompressedSize(null);

    try {
      const result = await compressImage(rawFile, {
        outputType: "image/webp",
        maxDimension: 2000,
        quality: 0.82,
        signal: controller.signal,
      });
      if (requestId !== requestRef.current || controller.signal.aborted) return;
      const baseName = rawFile.name.replace(/\.[^.]+$/, "") || (isProduct ? "product-photo" : "business-photo");
      const compressed = new File([result.blob], `${baseName}.webp`, { type: "image/webp" });
      onChange(compressed);
      setCompressedSize(compressed.size);
      setStatus("ready");
    } catch (compressionError) {
      if (requestId !== requestRef.current || controller.signal.aborted) return;
      setStatus("error");
      setErrorMessage(
        compressionError instanceof CompressionError
          ? "Foto tidak dapat diproses. Pilih foto lain dan coba lagi."
          : "Foto tidak dapat diproses. Coba lagi.",
      );
      onChange(null);
    }
  }

  function removeFile() {
    abortRef.current?.abort();
    requestRef.current += 1;
    setStatus("idle");
    setOriginalSize(null);
    setCompressedSize(null);
    setErrorMessage(undefined);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const describedBy = error || errorMessage ? errorId : undefined;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void processFile(file);
        }}
        disabled={disabled || status === "compressing"}
        aria-describedby={describedBy}
      />

      {!value && existingUrl && status !== "compressing" && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={existingUrl} alt={previewAlt} className="h-20 w-20 rounded-xl object-cover" />
          <p className="text-sm text-slate-600">Foto saat ini tersimpan. Unggah foto baru untuk menggantinya.</p>
        </div>
      )}

      {!value && status !== "compressing" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files[0];
            if (file) void processFile(file);
          }}
          disabled={disabled}
          className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 transition ${
            dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/50"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <UploadCloud className="h-11 w-11 text-blue-500" aria-hidden="true" />
          <span className="mt-3 text-sm font-semibold text-blue-700">{uploadLabel}</span>
          <span className="mt-1 text-xs text-slate-500">JPEG, PNG, atau WebP · maksimal 10 MB</span>
          <span className="mt-1 text-xs text-slate-500">{uploadHint}</span>
        </button>
      ) : status === "compressing" ? (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-6 text-sm font-medium text-blue-800" role="status" aria-live="polite">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Mengompres foto tanpa mengganggu halaman…
        </div>
      ) : value ? (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[128px_1fr_auto] sm:items-center">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={previewAlt} className="h-28 w-32 rounded-xl object-cover" />
          ) : (
            <div className="flex h-28 w-32 items-center justify-center rounded-xl bg-slate-100"><ImageIcon className="h-8 w-8 text-slate-400" /></div>
          )}
          <div>
            <p className="font-semibold text-slate-900">{value.name}</p>
            <p className="mt-1 text-sm text-slate-500">WebP · {formatFileSize(compressedSize ?? value.size)}</p>
            {originalSize !== null && <p className="mt-1 text-xs font-medium text-blue-700">{formatSavings(originalSize, compressedSize ?? value.size)}</p>}
          </div>
          <button type="button" onClick={removeFile} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
          </button>
        </div>
      ) : null}

      {(error || errorMessage) && (
        <p id={errorId} className="mt-2 text-sm font-medium text-red-600" role="alert">
          {error || errorMessage}
        </p>
      )}
    </div>
  );
}