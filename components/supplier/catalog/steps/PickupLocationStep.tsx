"use client";

import { MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { SupplierLocationMapClient } from "@/components/supplier/SupplierLocationMapClient";
import type { CatalogDraft, FieldErrors } from "@/lib/supplier-catalog/types";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";
import { formatCoordinate } from "@/lib/maps/leaflet-demo";

interface PickupLocationStepProps {
  draft: CatalogDraft;
  errors: FieldErrors;
  disabled: boolean;
  locationLocked?: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onFieldChange: (field: "pickupName" | "pickupAddress", value: string) => void;
  onCoordinateChange: (coord: MapCoordinate) => void;
}

export default function PickupLocationStep({
  draft,
  errors,
  disabled,
  locationLocked = false,
  headingRef,
  onFieldChange,
  onCoordinateChange,
}: PickupLocationStepProps) {
  const inputsDisabled = disabled || locationLocked;
  const coordinate: MapCoordinate | null =
    draft.pickupLatitude !== null && draft.pickupLongitude !== null
      ? { lat: draft.pickupLatitude, lng: draft.pickupLongitude }
      : null;

  return (
    <div className="space-y-6">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-bold text-slate-900 outline-none"
      >
        Lokasi Pengambilan
      </h2>
      <p className="text-sm text-slate-500">
        Tentukan titik kumpul tempat UMKM akan mengambil barang. Koordinat harus berada dalam wilayah Bandung.
      </p>

      {/* Location lock notice */}
      {locationLocked && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4" role="alert">
          <MapPin size={18} className="mt-0.5 shrink-0 text-orange-600" />
          <div className="text-sm text-orange-800">
            <p className="font-semibold">Lokasi dikunci permanen</p>
            <p className="mt-1">
              Sudah ada peserta terdaftar pada penawaran ini, sehingga lokasi pengambilan tidak dapat diubah. Buat penawaran baru jika ingin pindah lokasi.
            </p>
          </div>
        </div>
      )}

      {/* Nama Lokasi */}
      <div>
        <label
          htmlFor="pickup-name"
          className="block text-sm font-semibold text-slate-800"
        >
          Nama Lokasi <span className="text-red-500">*</span>
        </label>
        <input
          id="pickup-name"
          type="text"
          required
          value={draft.pickupName}
          onChange={(e) => onFieldChange("pickupName", e.target.value)}
          disabled={inputsDisabled}
          placeholder="Contoh: Gudang Bandung Pusat"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {errors.pickupName && (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.pickupName}
          </p>
        )}
      </div>

      {/* Alamat Teks */}
      <div>
        <label
          htmlFor="pickup-address"
          className="block text-sm font-semibold text-slate-800"
        >
          Alamat Lengkap <span className="text-red-500">*</span>
        </label>
        <textarea
          id="pickup-address"
          required
          value={draft.pickupAddress}
          onChange={(e) => onFieldChange("pickupAddress", e.target.value)}
          disabled={inputsDisabled}
          rows={3}
          placeholder="Alamat lengkap lokasi pengambilan di Bandung"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
        {errors.pickupAddress && (
          <p className="mt-1 text-xs font-medium text-red-600" role="alert">
            {errors.pickupAddress}
          </p>
        )}
      </div>

      {/* Pin Peta */}
      <div>
        <label className="block text-sm font-semibold text-slate-800">
          Pin Peta Presisi <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Klik pada peta untuk menandai lokasi pengambilan yang tepat.
        </p>
        <div className="mt-2">
          <SupplierLocationMapClient
            value={coordinate}
            onChange={onCoordinateChange}
            error={errors.pickupCoordinate}
            disabled={inputsDisabled}
          />
        </div>
        {coordinate && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <MapPin size={14} className="shrink-0 text-blue-600" />
            <span>
              Koordinat terpilih: <strong className="font-mono">{formatCoordinate(coordinate)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-xs text-amber-800">
        <MapPin size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Penting:</p>
          <ul className="mt-1 space-y-0.5">
            <li>&bull; Lokasi pengambilan akan terkunci permanen setelah ada 1 peserta terdaftar.</li>
            <li>&bull; Supplier harus membatalkan penawaran lama jika ingin pindah lokasi.</li>
            <li>&bull; Koordinat harus berada dalam wilayah Bandung.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
