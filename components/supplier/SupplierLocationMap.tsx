"use client";

import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  BANDUNG_CENTER,
  formatCoordinate,
  isValidCoordinate,
  type MapCoordinate,
} from "@/lib/maps/leaflet-demo";

type LocationStatus = "idle" | "locating" | "found" | "error";

interface SupplierLocationMapProps {
  value: MapCoordinate | null;
  onChange: (coordinate: MapCoordinate) => void;
  error?: string;
  disabled?: boolean;
}

function MapClickHandler({ onSelect }: { onSelect: (coordinate: MapCoordinate) => void }) {
  useMapEvents({
    click(event) {
      onSelect({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function MapViewport({ coordinate }: { coordinate: MapCoordinate }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([coordinate.lat, coordinate.lng], 15, { duration: 0.8 });
  }, [coordinate, map]);
  return null;
}

export default function SupplierLocationMap({
  value,
  onChange,
  error,
  disabled = false,
}: SupplierLocationMapProps) {
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [message, setMessage] = useState("Klik peta untuk memilih titik lokasi usaha.");
  const coordinate = value ?? BANDUNG_CENTER;

  function selectCoordinate(nextCoordinate: MapCoordinate) {
    if (disabled || !isValidCoordinate(nextCoordinate)) return;
    onChange(nextCoordinate);
    setLocationStatus("idle");
    setMessage("Titik lokasi usaha berhasil dipilih.");
  }

  function locateUser() {
    if (disabled) return;
    if (!("geolocation" in navigator)) {
      setLocationStatus("error");
      setMessage("Browser ini tidak mendukung pencarian lokasi perangkat.");
      return;
    }

    setLocationStatus("locating");
    setMessage("Meminta lokasi perangkat…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoordinate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        if (!isValidCoordinate(nextCoordinate)) {
          setLocationStatus("error");
          setMessage("Koordinat perangkat tidak valid.");
          return;
        }
        onChange(nextCoordinate);
        setLocationStatus("found");
        setMessage("Lokasi perangkat berhasil dipilih.");
      },
      () => {
        setLocationStatus("error");
        setMessage("Lokasi tidak dapat diakses. Pastikan izin lokasi diberikan.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            {value ? "Titik lokasi terpilih" : "Titik lokasi belum dipilih"}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
            {value ? formatCoordinate(value) : "Pilih titik pada peta"}
          </p>
          <p className="mt-1 text-sm text-slate-500" aria-live="polite">
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={locateUser}
          disabled={disabled || locationStatus === "locating"}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {locationStatus === "locating" ? "Mencari lokasi…" : "Gunakan lokasi saya"}
        </button>
      </div>

      <div className="relative h-72 overflow-hidden rounded-2xl border border-slate-200 sm:h-80">
        <MapContainer
          center={[BANDUNG_CENTER.lat, BANDUNG_CENTER.lng]}
          zoom={13}
          scrollWheelZoom={!disabled}
          dragging={!disabled}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onSelect={selectCoordinate} />
          <MapViewport coordinate={coordinate} />
          {value && (
            <CircleMarker
              center={[value.lat, value.lng]}
              radius={10}
              pathOptions={{ color: "#ffffff", fillColor: "#2563eb", fillOpacity: 1, weight: 4 }}
            >
              <Popup>
                <strong>Lokasi usaha</strong>
                <br />
                {formatCoordinate(value)}
              </Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
      {error && (
        <p className="mt-2 text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
