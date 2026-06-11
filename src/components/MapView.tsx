"use client";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RankedVenue } from "@/lib/engine/rank";
import type { DealState } from "@/lib/engine/status";
import { CHICAGO_CENTER } from "@/lib/hooks/useGeolocation";

function pinClass(state: DealState): string {
  if (state === "LIVE") return "lc-pin lc-pin--live";
  if (state === "STARTS_SOON") return "lc-pin lc-pin--soon";
  return "lc-pin lc-pin--dim";
}

function venueIcon(r: RankedVenue, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="${pinClass(r.status.state)}${selected ? " lc-pin--selected" : ""}">${r.score}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

const userIcon = L.divIcon({
  className: "",
  html: `<div class="lc-user"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Imperatively recenter when the user location or selection changes. */
function MapController({
  userLoc,
  focus,
}: {
  userLoc: { lat: number; lng: number } | null;
  focus: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), {
      duration: 0.6,
    });
  }, [focus, map]);
  useEffect(() => {
    if (userLoc) map.flyTo([userLoc.lat, userLoc.lng], 14, { duration: 0.8 });
  }, [userLoc, map]);
  return null;
}

export default function MapView({
  ranked,
  selectedSlug,
  onSelect,
  userLoc,
}: {
  ranked: RankedVenue[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  userLoc: { lat: number; lng: number } | null;
}) {
  const center = userLoc ?? CHICAGO_CENTER;
  const focus = useMemo(() => {
    const sel = ranked.find((r) => r.venue.slug === selectedSlug);
    return sel && sel.venue.lat != null && sel.venue.lng != null
      ? { lat: sel.venue.lat, lng: sel.venue.lng }
      : null;
  }, [ranked, selectedSlug]);

  return (
    <div className="map-tint absolute inset-0">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        zoomControl={false}
        attributionControl
        className="h-full w-full"
        style={{ background: "#16100B" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />
        <MapController userLoc={userLoc} focus={focus} />
        {userLoc && (
          <Marker position={[userLoc.lat, userLoc.lng]} icon={userIcon} />
        )}
        {ranked.map((r) =>
          r.venue.lat != null && r.venue.lng != null ? (
            <Marker
              key={r.venue.id}
              position={[r.venue.lat, r.venue.lng]}
              icon={venueIcon(r, r.venue.slug === selectedSlug)}
              eventHandlers={{ click: () => onSelect(r.venue.slug) }}
            />
          ) : null
        )}
      </MapContainer>
    </div>
  );
}
