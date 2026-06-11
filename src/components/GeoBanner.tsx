"use client";
import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useGeolocation } from "@/lib/hooks/useGeolocation";

/** Shown only when location was denied/failed. Never blocks the app. */
export function GeoBanner() {
  const geoStatus = useStore((s) => s.geoStatus);
  const { request } = useGeolocation();
  const [dismissed, setDismissed] = useState(false);

  if (geoStatus !== "denied" || dismissed) return null;

  return (
    <div className="pointer-events-auto absolute inset-x-3 top-[68px] z-[1100] flex items-center gap-2 rounded-coaster border border-brass/30 bg-surface/95 px-3 py-2 text-[12px] text-cream shadow-lg backdrop-blur">
      <MapPin className="h-4 w-4 shrink-0 text-neon-amber" />
      <span className="flex-1">
        Showing the Loop. Enable location for walk times &amp; the nearest live
        deal.
      </span>
      <button
        type="button"
        onClick={request}
        className="shrink-0 rounded-full bg-neon-amber/20 px-2.5 py-1 text-[11px] font-semibold text-neon-amber"
      >
        Retry
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-muted"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
