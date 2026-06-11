"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Navigation2, Compass } from "lucide-react";
import type { RankedVenue } from "@/lib/engine/rank";
import { bearing, haversineMeters, formatDistance, formatWalk } from "@/lib/engine/distance";
import { useDeviceHeading } from "@/lib/hooks/useDeviceHeading";
import { CountdownChip } from "./CountdownChip";

/**
 * BEELINE MODE — a drunk-proof full-screen compass. One giant glowing arrow
 * points at the best LIVE deal using device orientation + geolocation bearing,
 * with the distance counting down as you walk. No-compass devices get a static
 * north-relative arrow and a heads-up.
 */
export function BeelineMode({
  target,
  initialUser,
  now,
  onClose,
}: {
  target: RankedVenue;
  initialUser: { lat: number; lng: number };
  now: Date;
  onClose: () => void;
}) {
  const { heading, supported, start } = useDeviceHeading();
  const [user, setUser] = useState(initialUser);

  useEffect(() => {
    start();
  }, [start]);

  // Live position updates as the user walks toward the bar.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setUser({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const { lat, lng } = target.venue;
  if (lat == null || lng == null) return null;

  const brg = bearing(user.lat, user.lng, lat, lng);
  const meters = haversineMeters(user.lat, user.lng, lat, lng);
  // If we have a compass, rotate relative to it; else point north-relative.
  const rotation = heading != null ? (brg - heading + 360) % 360 : brg;
  const arrived = meters < 25;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[3000] flex flex-col items-center justify-between bg-ink px-6 py-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+28px)]"
    >
      <div className="flex w-full items-start justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-brass">
            Beeline to
          </p>
          <h2 className="neon-amber font-display text-2xl leading-tight">
            {target.venue.name}
          </h2>
          <div className="mt-2">
            <CountdownChip status={target.status} now={now} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit beeline"
          className="grid h-10 w-10 place-items-center rounded-full border border-brass/30 text-cream"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* The arrow */}
      <div className="relative grid place-items-center">
        <div className="absolute h-72 w-72 rounded-full border border-neon-amber/15" />
        <div className="absolute h-52 w-52 rounded-full border border-neon-amber/10" />
        {arrived ? (
          <div className="grid place-items-center text-center">
            <span className="neon-amber neon-flicker font-display text-4xl">
              YOU MADE IT
            </span>
            <span className="mt-2 text-sm text-brass">Go get your drink.</span>
          </div>
        ) : (
          <motion.div
            animate={{ rotate: rotation }}
            transition={{ type: "spring", stiffness: 90, damping: 14 }}
            className="grid place-items-center"
          >
            <Navigation2
              className="neon-amber h-40 w-40"
              fill="currentColor"
              strokeWidth={1}
              style={{ filter: "drop-shadow(0 0 18px rgba(255,181,46,0.6))" }}
            />
          </motion.div>
        )}
      </div>

      {/* Distance readout */}
      <div className="text-center">
        <div className="tabular neon-amber font-display text-5xl">
          {formatDistance(meters)}
        </div>
        <div className="tabular mt-1 text-sm text-brass">{formatWalk(meters)}</div>
        <div className="mt-1 truncate text-[13px] text-cream">{target.headline}</div>
        {(heading == null || !supported) && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted">
            <Compass className="h-3.5 w-3.5" />
            {supported
              ? "Calibrating compass — arrow points north-relative for now."
              : "No compass on this device — arrow is north-relative. Hold phone flat & face north."}
          </p>
        )}
      </div>
    </motion.div>
  );
}
