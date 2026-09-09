"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { formatCoordinate } from "@/lib/maps/leaflet-demo";

export interface PickupLocationMapProps {
  latitude: number;
  longitude: number;
  address: string;
}

export default function PickupLocationMap({
  latitude,
  longitude,
  address,
}: PickupLocationMapProps) {
  return (
    <div className="relative h-[260px] w-full overflow-hidden rounded-xl border border-slate-200">
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        className="h-full w-full"
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <CircleMarker
          center={[latitude, longitude]}
          radius={10}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#2563eb",
            fillOpacity: 1,
            weight: 4,
          }}
        >
          <Popup>
            <strong className="text-sm">Titik Kumpul</strong>
            <br />
            <span className="text-xs">{address}</span>
            <br />
            <span className="text-xs text-slate-500">
              {formatCoordinate({ lat: latitude, lng: longitude })}
            </span>
          </Popup>
        </CircleMarker>
      </MapContainer>
      <div className="absolute bottom-0 left-0 right-0 z-[1000] border-t border-slate-200 bg-white/95 backdrop-blur-sm px-3 py-2">
        <p className="text-xs font-medium text-slate-700 truncate">{address}</p>
        <p className="text-[10px] text-slate-400 font-mono">
          {formatCoordinate({ lat: latitude, lng: longitude })}
        </p>
      </div>
    </div>
  );
}
