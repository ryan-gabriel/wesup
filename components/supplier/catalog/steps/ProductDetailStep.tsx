"use client";

import { ImageIcon } from "lucide-react";
import { BATCH_CATEGORIES } from "@/lib/catalog/categories";
import BusinessPhotoField from "@/components/supplier/BusinessPhotoField";
import type { CatalogDraft, FieldErrors } from "@/lib/supplier-catalog/types";

interface ProductDetailStepProps {
  draft: CatalogDraft;
  errors: FieldErrors;
  disabled: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onFieldChange: (field: "title" | "category" | "description", value: string) => void;
  onTargetQuantityChange: (value: number) => void;
  onPhotoChange: (file: File | null) => void;
}

export default function ProductDetailStep({
  draft,
  errors,
  disabled,
  headingRef,
  onFieldChange,
  onTargetQuantityChange,
  onPhotoChange,
}: ProductDetailStepProps) {
  return (
    <div className="space-y-6">
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-slate-900 outline-none">
        Detail Produk
      </h2>
      <p className="text-sm text-slate-500">Isi informasi dasar produk yang ingin Anda tawarkan.</p>

      <div>
        <label htmlFor="catalog-title" className="block text-sm font-semibold text-slate-800">
          Nama Produk <span className="text-red-500">*</span>
        </label>
        <input
          id="catalog-title"
          type="text"
          required
          value={draft.title}
          onChange={(e) => onFieldChange("title", e.target.value)}
          disabled={disabled}
          placeholder="Contoh: Beras Rojolele 5 kg"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {errors.title && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.title}</p>}
      </div>

      <div>
        <label htmlFor="catalog-category" className="block text-sm font-semibold text-slate-800">
          Kategori <span className="text-red-500">*</span>
        </label>
        <select
          id="catalog-category"
          required
          value={draft.category}
          onChange={(e) => onFieldChange("category", e.target.value)}
          disabled={disabled}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <option value="" disabled>Pilih kategori...</option>
          {BATCH_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        {errors.category && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.category}</p>}
      </div>

      <div>
        <label htmlFor="catalog-target-quantity" className="block text-sm font-semibold text-slate-800">
          Target kelompok (pcs) <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-slate-500">Jumlah minimum volume yang ingin dicapai sebelum batch diproses.</p>
        <input
          id="catalog-target-quantity"
          type="number"
          min={1}
          step={1}
          required
          value={draft.targetQuantity || ""}
          onChange={(e) => onTargetQuantityChange(Number(e.target.value) || 0)}
          disabled={disabled}
          placeholder="Contoh: 50"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {errors.targetQuantity && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.targetQuantity}</p>}
      </div>

      <div>
        <label htmlFor="catalog-description" className="block text-sm font-semibold text-slate-800">
          Deskripsi <span className="text-red-500">*</span>
        </label>
        <textarea
          id="catalog-description"
          required
          value={draft.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          disabled={disabled}
          rows={4}
          placeholder="Jelaskan produk Anda, kualitas, keunggulan, dll."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {errors.description && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.description}</p>}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <ImageIcon size={17} className="text-blue-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Foto Produk <span className="text-red-500">*</span></p>
            <p className="text-xs text-slate-500">JPEG, PNG, atau WebP maksimal 10 MB. Akan dikompresi menjadi WebP.</p>
          </div>
        </div>
        <BusinessPhotoField
          value={draft.productPhoto}
          onChange={onPhotoChange}
          error={errors.productPhoto}
          disabled={disabled}
          variant="product"
          existingUrl={draft.productPhotoUrl}
        />
      </div>
    </div>
  );
}