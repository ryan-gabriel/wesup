"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Hanya format JPEG, PNG, atau WebP yang diizinkan.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Ukuran file melebihi batas maksimal 10 MB (saat ini ${formatFileSize(file.size)}).`;
  }
  return null;
}

export interface FileUploadPreviewProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  error?: string;
  disabled?: boolean;
  label?: string;
  description?: string;
}

export default function FileUploadPreview({
  files,
  onChange,
  maxFiles = 5,
  error,
  disabled = false,
  label = "Unggah foto bukti",
  description = "JPEG, PNG, atau WebP · maks 10 MB per file",
}: FileUploadPreviewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const previewUrls = useMemo(
    () => files.map((f) => URL.createObjectURL(f)),
    [files],
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const errors: string[] = [];
      const valid: File[] = [];

      for (const file of incoming) {
        const err = validateFile(file);
        if (err) {
          errors.push(`${file.name}: ${err}`);
        } else if (files.length + valid.length < maxFiles) {
          valid.push(file);
        } else {
          errors.push(`Batas maksimal ${maxFiles} file tercapai.`);
        }
      }

      setValidationErrors(errors);
      if (valid.length > 0) {
        onChange([...files, ...valid]);
      }
    },
    [files, maxFiles, onChange],
  );

  const removeFile = useCallback(
    (index: number) => {
      onChange(files.filter((_, i) => i !== index));
    },
    [files, onChange],
  );

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        disabled={disabled || files.length >= maxFiles}
        onChange={(e) => {
          if (e.target.files) processFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length < maxFiles && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files.length > 0) {
              processFiles(e.dataTransfer.files);
            }
          }}
          disabled={disabled}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition",
            dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/50",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <UploadCloud className="h-10 w-10 text-blue-500" aria-hidden="true" />
          <span className="mt-2 text-sm font-semibold text-blue-700">{label}</span>
          <span className="mt-1 text-xs text-slate-500">{description}</span>
          <span className="mt-1 text-xs text-slate-400">
            {files.length}/{maxFiles} file terpilih
          </span>
        </button>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-2" role="list" aria-label="File terpilih">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              {previewUrls[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrls[index]}
                  alt={`Pratinjau ${file.name}`}
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <ImageIcon className="h-6 w-6 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={disabled}
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                aria-label={`Hapus ${file.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-2 text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      )}

      {validationErrors.length > 0 && (
        <ul className="mt-2 space-y-1" role="alert">
          {validationErrors.map((msg, i) => (
            <li key={i} className="text-sm font-medium text-red-600">
              {msg}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
