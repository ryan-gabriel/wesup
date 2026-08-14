import { MapCoordinate } from "./leaflet-demo";

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Bounding box for Greater Bandung (Kota Bandung, Cimahi, Kab. Bandung, Kab. Bandung Barat).
 * Centered around -6.9175, 107.6191.
 */
export const BANDUNG_BOUNDS: Readonly<GeoBounds> = {
  minLat: -7.15,
  maxLat: -6.7,
  minLng: 107.4,
  maxLng: 107.85,
};

export const BANDUNG_CENTER: Readonly<MapCoordinate> = {
  lat: -6.9175,
  lng: 107.6191,
};

/**
 * Checks if a coordinate is within Bandung regional boundaries.
 */
export function isWithinBandung(coordinate: { lat?: number | null; lng?: number | null }): boolean {
  if (
    coordinate.lat === null ||
    coordinate.lat === undefined ||
    coordinate.lng === null ||
    coordinate.lng === undefined ||
    !Number.isFinite(coordinate.lat) ||
    !Number.isFinite(coordinate.lng)
  ) {
    return false;
  }

  return (
    coordinate.lat >= BANDUNG_BOUNDS.minLat &&
    coordinate.lat <= BANDUNG_BOUNDS.maxLat &&
    coordinate.lng >= BANDUNG_BOUNDS.minLng &&
    coordinate.lng <= BANDUNG_BOUNDS.maxLng
  );
}

/**
 * Validates a pair of latitude and longitude coordinates for supplier location.
 */
export function validateSupplierLocation(
  lat: unknown,
  lng: unknown,
): { valid: boolean; error?: string } {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return {
      valid: false,
      error: "Koordinat pin map lokasi usaha wajib diisi.",
    };
  }

  const numLat = typeof lat === "number" ? lat : Number(lat);
  const numLng = typeof lng === "number" ? lng : Number(lng);

  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
    return {
      valid: false,
      error: "Koordinat pin map tidak valid (harus berupa angka).",
    };
  }

  if (!isWithinBandung({ lat: numLat, lng: numLng })) {
    return {
      valid: false,
      error: "Lokasi titik usaha berada di luar batas wilayah operasional Bandung.",
    };
  }

  return { valid: true };
}
