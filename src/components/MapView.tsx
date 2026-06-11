"use client";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RankedVenue } from "@/lib/engine/rank";
import { HQ, RADIUS_METERS } from "@/lib/hq";

/**
 * Marker visuals carry the lifecycle story: EXTRACTED venues glow with their
 * Steal Score (live = red pulse, soon = amber), SCOUTED show an amber dot,
 * UNSCOUTED a faint ember, NO_DEAL_FOUND a dim ring. The city lights up over
 * time as the pipeline works.
 */
function venueIcon(r: RankedVenue, selected: boolean): L.DivIcon {
  const lc = r.venue.lifecycle;
  let cls = "lc-pin lc-pin--ember";
  let label = "";
  if (lc === "EXTRACTED") {
    cls =
      r.status.state === "LIVE"
        ? "lc-pin lc-pin--live"
        : r.status.state === "STARTS_SOON"
          ? "lc-pin lc-pin--soon"
          : "lc-pin lc-pin--dim";
    label = String(r.score);
  } else if (lc === "SCOUTED") {
    cls = "lc-pin lc-pin--scouted";
  } else if (lc === "NO_DEAL_FOUND") {
    cls = "lc-pin lc-pin--nodeal";
  }
  const wtt = r.venue.tags.includes("worth-the-trip") ? " lc-pin--wtt" : "";
  return L.divIcon({
    className: "",
    html: `<div class="${cls}${wtt}${selected ? " lc-pin--selected" : ""}">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
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

const hqIcon = L.divIcon({
  className: "",
  html: `<div class="lc-hq" title="330 N Wabash">HQ</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function MapView({
  ranked,
  selectedSlug,
  onSelect,
  userLoc,
  anchorPoint,
}: {
  ranked: RankedVenue[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  userLoc: { lat: number; lng: number } | null;
  anchorPoint: { lat: number; lng: number };
}) {
  const focus = useMemo(() => {
    const sel = ranked.find((r) => r.venue.slug === selectedSlug);
    return sel && sel.venue.lat != null && sel.venue.lng != null
      ? { lat: sel.venue.lat, lng: sel.venue.lng }
      : null;
  }, [ranked, selectedSlug]);

  return (
    <div className="map-tint absolute inset-0">
      <MapContainer
        center={[HQ.lat, HQ.lng]}
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
        {/* 2-mile coverage ring around HQ */}
        <Circle
          center={[HQ.lat, HQ.lng]}
          radius={RADIUS_METERS}
          pathOptions={{
            color: "#C49A6C",
            weight: 1,
            opacity: 0.35,
            fillColor: "#FFB52E",
            fillOpacity: 0.03,
          }}
        />
        <MapController userLoc={focus ? null : anchorPoint} focus={focus} />
        <Marker position={[HQ.lat, HQ.lng]} icon={hqIcon} />
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
