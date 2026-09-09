"use client";

import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { MarketplaceItem, MarketplaceOrigin } from "@/lib/marketplace/types";

export interface MarketplaceRadiusMapProps {
  origin: MarketplaceOrigin;
  items: readonly MarketplaceItem[];
  radiusKm: number;
  className?: string;
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export default function MarketplaceRadiusMap({
  origin,
  items,
  radiusKm,
  className = "",
}: MarketplaceRadiusMapProps) {
  const center: [number, number] = [origin.latitude, origin.longitude];
  const safeRadiusKm = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : 1;
  const validItems = items.filter((item) =>
    isValidCoordinate(item.pickupLatitude, item.pickupLongitude),
  );

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
      data-testid="marketplace-radius-map"
      aria-label={`Peta penawaran dalam radius ${safeRadiusKm} kilometer`}
    >
      <div className="relative h-[320px] w-full md:h-[380px]">
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom={false}
          className="h-full w-full"
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Circle
            center={center}
            radius={safeRadiusKm * 1_000}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#3b82f6",
              fillOpacity: 0.1,
              weight: 2,
            }}
          />
          <CircleMarker
            center={center}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#1d4ed8",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>
              <strong>Lokasi Anda</strong>
              <br />
              Pusat pencarian radius {safeRadiusKm} km
            </Popup>
          </CircleMarker>
          {validItems.map((item) => (
            <CircleMarker
              key={item.id}
              center={[item.pickupLatitude, item.pickupLongitude]}
              radius={7}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#059669",
                fillOpacity: 0.95,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{item.title}</strong>
                <br />
                <span>{item.pickupAddress}</span>
                {item.distanceKm !== null ? (
                  <>
                    <br />
                    <span>{item.distanceKm.toLocaleString("id-ID", { maximumFractionDigits: 1 })} km dari pusat</span>
                  </>
                ) : null}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-[1000] flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm">
          <span className="font-bold text-slate-800">Radius {safeRadiusKm} km</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-700" /> Pusat pencarian</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> {validItems.length} titik pickup</span>
        </div>
      </div>
    </section>
  );
}
