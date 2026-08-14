import { describe, expect, it } from "vitest";
import {
  BANDUNG_CENTER,
  formatCoordinate,
  isValidCoordinate,
} from "@/lib/maps/leaflet-demo";

describe("Leaflet demo map helpers", () => {
  it("uses central Bandung as the initial map position", () => {
    expect(BANDUNG_CENTER).toEqual({ lat: -6.9175, lng: 107.6191 });
  });

  it("formats coordinates consistently for the demo panel", () => {
    expect(formatCoordinate({ lat: -6.9175, lng: 107.6191 })).toBe(
      "-6.91750, 107.61910",
    );
  });

  it("accepts geographic coordinate boundaries", () => {
    expect(isValidCoordinate({ lat: -90, lng: -180 })).toBe(true);
    expect(isValidCoordinate({ lat: 90, lng: 180 })).toBe(true);
  });

  it("rejects non-finite and out-of-range coordinates", () => {
    expect(isValidCoordinate({ lat: Number.NaN, lng: 107 })).toBe(false);
    expect(isValidCoordinate({ lat: -6, lng: Number.POSITIVE_INFINITY })).toBe(
      false,
    );
    expect(isValidCoordinate({ lat: -91, lng: 107 })).toBe(false);
    expect(isValidCoordinate({ lat: -6, lng: 181 })).toBe(false);
  });
});
