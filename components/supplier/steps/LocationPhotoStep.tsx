"use client";

import type { RefObject } from "react";
import { Camera } from "lucide-react";
import type { FieldErrors } from "@/lib/supplier-registration/contracts";
import type { MapCoordinate } from "@/lib/maps/leaflet-demo";
import BusinessPhotoField from "@/components/supplier/BusinessPhotoField";
import { SupplierLocationMapClient } from "@/components/supplier/SupplierLocationMapClient";

export interface LocationPhotoStepProps {
  coordinate: MapCoordinate | null;
  photo: File | null;
  errors: FieldErrors;
  disabled: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onCoordinateChange: (coordinate: MapCoordinate) => void;
  onPhotoChange: (photo: File | null) => void;
}

export default function LocationPhotoStep({
  coordinate,
  photo,
  errors,
  disabled,
  headingRef,
  onCoordinateChange,
  onPhotoChange,
}: LocationPhotoStepProps) {
  return (
    <section aria-labelledby="supplier-registration-location-title">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 ref={headingRef} id="supplier-registration-location-title" tabIndex={-1} className="text-2xl font-bold tracking-tight text-slate-950 outline-none sm:text-3xl">
            Tentukan lokasi usaha
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Pilih titik yang tepat dan unggah foto fisik tempat usaha.</p>
        </div>
        <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Langkah 3 dari 4</span>
      </div>

      <div id="supplier-location" className="mt-8">
        <SupplierLocationMapClient
          value={coordinate}
          onChange={onCoordinateChange}
          error={errors.location}
          disabled={disabled}
        />
      </div>

      <div id="business-photo" className="mt-8 border-t border-slate-100 pt-8">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Camera className="h-4 w-4 text-blue-600" aria-hidden="true" />
          Foto Fisik Tempat Usaha
        </label>
        <p className="mt-1 text-sm text-slate-500">Foto akan diproses menjadi WebP otomatis bila diperlukan.</p>
        <div className="mt-4">
          <BusinessPhotoField
            value={photo}
            onChange={onPhotoChange}
            error={errors.businessPhoto}
            disabled={disabled}
          />
        </div>
      </div>
    </section>
  );
}
