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

function MapClickHandler({
  onSelect,
}: {
  onSelect: (coordinate: MapCoordinate) => void;
}) {
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

export default function LeafletMap() {
  const [coordinate, setCoordinate] = useState<MapCoordinate>({
    ...BANDUNG_CENTER,
  });
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("idle");
  const [message, setMessage] = useState(
    "Klik area peta untuk memindahkan titik pengambilan.",
  );

  function selectCoordinate(nextCoordinate: MapCoordinate) {
    if (!isValidCoordinate(nextCoordinate)) return;
    setCoordinate(nextCoordinate);
    setLocationStatus("idle");
    setMessage("Titik dipindahkan berdasarkan pilihan pada peta.");
  }

  function resetToBandung() {
    setCoordinate({ ...BANDUNG_CENTER });
    setLocationStatus("idle");
    setMessage("Titik dikembalikan ke pusat Kota Bandung.");
  }

  function locateUser() {
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

        setCoordinate(nextCoordinate);
        setLocationStatus("found");
        setMessage("Lokasi perangkat berhasil ditemukan.");
      },
      () => {
        setLocationStatus("error");
        setMessage(
          "Lokasi tidak dapat diakses. Pastikan izin lokasi sudah diberikan.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-emerald-950/5">
      <div className="grid gap-4 border-b border-slate-100 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Titik terpilih
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-slate-900">
            {formatCoordinate(coordinate)}
          </p>
          <p className="mt-1 text-sm text-slate-500" aria-live="polite">
            {message}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={locateUser}
            disabled={locationStatus === "locating"}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {locationStatus === "locating"
              ? "Mencari lokasi…"
              : "Gunakan lokasi saya"}
          </button>
          <button
            type="button"
            onClick={resetToBandung}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Reset ke Bandung
          </button>
        </div>
      </div>

      <div className="relative h-[520px] w-full">
        <MapContainer
          center={[BANDUNG_CENTER.lat, BANDUNG_CENTER.lng]}
          zoom={13}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onSelect={selectCoordinate} />
          <MapViewport coordinate={coordinate} />
          <CircleMarker
            center={[coordinate.lat, coordinate.lng]}
            radius={10}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#059669",
              fillOpacity: 1,
              weight: 4,
            }}
          >
            <Popup>
              <strong>Titik pengambilan demo</strong>
              <br />
              {formatCoordinate(coordinate)}
            </Popup>
          </CircleMarker>
        </MapContainer>
      </div>
    </section>
  );
}
