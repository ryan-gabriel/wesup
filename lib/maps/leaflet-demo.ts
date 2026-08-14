export interface MapCoordinate {
  lat: number;
  lng: number;
}

export const BANDUNG_CENTER: Readonly<MapCoordinate> = {
  lat: -6.9175,
  lng: 107.6191,
};

export function isValidCoordinate(coordinate: MapCoordinate): boolean {
  return (
    Number.isFinite(coordinate.lat) &&
    Number.isFinite(coordinate.lng) &&
    coordinate.lat >= -90 &&
    coordinate.lat <= 90 &&
    coordinate.lng >= -180 &&
    coordinate.lng <= 180
  );
}

export function formatCoordinate(coordinate: MapCoordinate): string {
  return `${coordinate.lat.toFixed(5)}, ${coordinate.lng.toFixed(5)}`;
}
