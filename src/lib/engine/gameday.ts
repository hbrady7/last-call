import type { CityEvent, Venue } from "../types";
import { haversineMeters } from "./distance";

/* ───────────────────────────── GAME DAY MODE ──────────────────────────────
   When a Cubs/Sox home game is happening today, the bars around the ballpark
   light up: a pennant on the marker, a crowd warning in the planner. Driven
   entirely off the (now verified) MLB rows in the events feed. */

const BALLPARK_RADIUS_M = 1000; // 1 km around the park

function sameLocalDay(aIso: string, b: Date): boolean {
  const a = new Date(aIso);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface ActiveBallpark {
  event: CityEvent;
  lat: number;
  lng: number;
}

/** Sports events whose home game is TODAY (local). */
export function activeBallparks(events: CityEvent[], now: Date): ActiveBallpark[] {
  return events
    .filter((e) => e.category === "sports" && sameLocalDay(e.start, now))
    .map((e) => ({ event: e, lat: e.lat, lng: e.lng }));
}

/** Set of venueIds within 1 km of a ballpark hosting a game today. */
export function gameDayVenueIds(
  venues: Venue[],
  events: CityEvent[],
  now: Date
): Set<string> {
  const parks = activeBallparks(events, now);
  const ids = new Set<string>();
  if (parks.length === 0) return ids;
  for (const v of venues) {
    if (v.lat == null || v.lng == null) continue;
    for (const p of parks) {
      if (haversineMeters(v.lat, v.lng, p.lat, p.lng) <= BALLPARK_RADIUS_M) {
        ids.add(v.id);
        break;
      }
    }
  }
  return ids;
}
