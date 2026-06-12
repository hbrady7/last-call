"use client";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Supercluster from "supercluster";
import type { RankedVenue } from "@/lib/engine/rank";
import type { RankedEvent } from "@/lib/engine/events";
import type { EventCategory } from "@/lib/types";
import { HQ, RADIUS_METERS } from "@/lib/hq";

const EVENT_GLYPH: Record<EventCategory, string> = {
  music: "♪",
  festival: "✷",
  sports: "★",
  comedy: "☺",
  arts: "✦",
  film: "▶",
};

function eventIcon(r: RankedEvent, selected: boolean): L.DivIcon {
  const live = r.timing.state === "LIVE_NOW";
  const cls = `lc-event${live ? " lc-event--live" : ""}${selected ? " lc-event--selected" : ""}`;
  return L.divIcon({
    className: "",
    html: `<div class="${cls}">${EVENT_GLYPH[r.event.category]}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

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

function clusterIcon(count: number, maxScore: number, hasLive: boolean): L.DivIcon {
  const size = count > 100 ? 52 : count > 25 ? 46 : 40;
  const cls = hasLive ? "lc-cluster lc-cluster--live" : "lc-cluster";
  const label = count >= 1000 ? `${Math.round(count / 100) / 10}k` : `${count}`;
  return L.divIcon({
    className: "",
    html: `<div class="${cls}" style="width:${size}px;height:${size}px"><span>${label}</span>${maxScore > 0 ? `<em>${maxScore}</em>` : ""}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type PointProps = { slug: string; score: number; live: number };
type ClusterProps = { maxScore: number; hasLive: number };

/** Supercluster layer — keeps the map smooth at 1000+ venues. */
function ClusterLayer({
  ranked,
  selectedSlug,
  onSelect,
}: {
  ranked: RankedVenue[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const map = useMap();
  const [, setVersion] = useState(0);

  const bySlug = useMemo(() => {
    const m = new Map<string, RankedVenue>();
    for (const r of ranked) m.set(r.venue.slug, r);
    return m;
  }, [ranked]);

  const index = useMemo(() => {
    const sc = new Supercluster<PointProps, ClusterProps>({
      radius: 64,
      maxZoom: 17,
      map: (p) => ({ maxScore: p.score, hasLive: p.live }),
      reduce: (acc, p) => {
        acc.maxScore = Math.max(acc.maxScore, p.maxScore);
        acc.hasLive = Math.max(acc.hasLive, p.hasLive);
      },
    });
    sc.load(
      ranked
        .filter((r) => r.venue.lat != null && r.venue.lng != null)
        .map((r) => ({
          type: "Feature" as const,
          properties: {
            slug: r.venue.slug,
            score: r.score,
            live: r.status.state === "LIVE" ? 1 : 0,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [r.venue.lng as number, r.venue.lat as number],
          },
        }))
    );
    return sc;
  }, [ranked]);

  useMapEvents({
    moveend: () => setVersion((v) => v + 1),
    zoomend: () => setVersion((v) => v + 1),
  });
  useEffect(() => setVersion((v) => v + 1), [index]);

  const b = map.getBounds();
  const bbox: [number, number, number, number] = [
    b.getWest(),
    b.getSouth(),
    b.getEast(),
    b.getNorth(),
  ];
  const zoom = Math.round(map.getZoom());
  const clusters = index.getClusters(bbox, zoom);

  return (
    <>
      {clusters.map((c) => {
        const [lng, lat] = c.geometry.coordinates;
        const props = c.properties as Supercluster.ClusterProperties & ClusterProps;
        if (props.cluster) {
          return (
            <Marker
              key={`cl-${props.cluster_id}`}
              position={[lat, lng]}
              icon={clusterIcon(props.point_count, props.maxScore, props.hasLive > 0)}
              eventHandlers={{
                click: () => {
                  const z = Math.min(index.getClusterExpansionZoom(props.cluster_id), 18);
                  map.flyTo([lat, lng], z, { duration: 0.5 });
                },
              }}
            />
          );
        }
        const slug = (c.properties as PointProps).slug;
        const r = bySlug.get(slug);
        if (!r) return null;
        return (
          <Marker
            key={r.venue.id}
            position={[lat, lng]}
            icon={venueIcon(r, slug === selectedSlug)}
            eventHandlers={{ click: () => onSelect(slug) }}
          />
        );
      })}
    </>
  );
}

export default function MapView({
  ranked,
  selectedSlug,
  onSelect,
  userLoc,
  anchorPoint,
  events = [],
  selectedEventId = null,
  onSelectEvent,
}: {
  ranked: RankedVenue[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  userLoc: { lat: number; lng: number } | null;
  anchorPoint: { lat: number; lng: number };
  events?: RankedEvent[];
  selectedEventId?: string | null;
  onSelectEvent?: (id: string) => void;
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
        <ClusterLayer
          ranked={ranked}
          selectedSlug={selectedSlug}
          onSelect={onSelect}
        />
        {/* Chicago events layer — cyan marquee pins above the amber deals */}
        {events.map((r) => (
          <Marker
            key={`ev-${r.event.id}`}
            position={[r.event.lat, r.event.lng]}
            icon={eventIcon(r, r.event.id === selectedEventId)}
            zIndexOffset={1000}
            eventHandlers={{ click: () => onSelectEvent?.(r.event.id) }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
