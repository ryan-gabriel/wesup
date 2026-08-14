import { describe, expect, it } from "vitest";
import {
  BANDUNG_BOUNDS,
  BANDUNG_CENTER,
  isWithinBandung,
  validateSupplierLocation,
} from "@/lib/maps/bandung";

describe("Bandung geographic boundaries and validation", () => {
  it("defines consistent bounding box covering Greater Bandung", () => {
    expect(BANDUNG_BOUNDS.minLat).toBeLessThan(BANDUNG_CENTER.lat);
    expect(BANDUNG_BOUNDS.maxLat).toBeGreaterThan(BANDUNG_CENTER.lat);
    expect(BANDUNG_BOUNDS.minLng).toBeLessThan(BANDUNG_CENTER.lng);
    expect(BANDUNG_BOUNDS.maxLng).toBeGreaterThan(BANDUNG_CENTER.lng);
  });

  it("validates center of Bandung as within bounds", () => {
    expect(isWithinBandung({ lat: -6.9175, lng: 107.6191 })).toBe(true);
  });

  it("validates various landmarks in Bandung", () => {
    // Alun-alun Bandung
    expect(isWithinBandung({ lat: -6.9218, lng: 107.6074 })).toBe(true);
    // Dago / ITB
    expect(isWithinBandung({ lat: -6.8915, lng: 107.6107 })).toBe(true);
    // Gedung Sate
    expect(isWithinBandung({ lat: -6.9025, lng: 107.6186 })).toBe(true);
    // Buah Batu / Bandung Kidul
    expect(isWithinBandung({ lat: -6.9555, lng: 107.6355 })).toBe(true);
    // Cimahi / Bandung Barat edge
    expect(isWithinBandung({ lat: -6.8722, lng: 107.5422 })).toBe(true);
    // Cibiru / Ubertos edge
    expect(isWithinBandung({ lat: -6.9171, lng: 107.7121 })).toBe(true);
  });

  it("rejects coordinates outside Bandung region", () => {
    // Jakarta (Monas)
    expect(isWithinBandung({ lat: -6.1754, lng: 106.8272 })).toBe(false);
    // Surabaya
    expect(isWithinBandung({ lat: -7.2575, lng: 112.7521 })).toBe(false);
    // Yogyakarta
    expect(isWithinBandung({ lat: -7.7956, lng: 110.3695 })).toBe(false);
    // Bali
    expect(isWithinBandung({ lat: -8.4095, lng: 115.1889 })).toBe(false);
  });

  it("rejects non-numeric, null, undefined, and NaN coordinates", () => {
    expect(isWithinBandung({ lat: Number.NaN, lng: 107.6191 })).toBe(false);
    expect(isWithinBandung({ lat: -6.9175, lng: Number.NaN })).toBe(false);
    expect(validateSupplierLocation(null, 107.6191).valid).toBe(false);
    expect(validateSupplierLocation(-6.9175, undefined).valid).toBe(false);
    expect(validateSupplierLocation("invalid", 107.6191).valid).toBe(false);
  });

  it("returns meaningful error message for out-of-bounds coordinates", () => {
    const resEmpty = validateSupplierLocation(null, null);
    expect(resEmpty.valid).toBe(false);
    expect(resEmpty.error).toMatch(/koordinat|coordinate/i);

    const resJakarta = validateSupplierLocation(-6.1754, 106.8272);
    expect(resJakarta.valid).toBe(false);
    expect(resJakarta.error).toMatch(/Bandung/i);

    const resValid = validateSupplierLocation(-6.9175, 107.6191);
    expect(resValid.valid).toBe(true);
    expect(resValid.error).toBeUndefined();
  });
});
