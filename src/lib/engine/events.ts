import type { CityEvent } from "../types";
import type { RankedVenue } from "./rank";
import { haversineMeters, walkMinutes } from "./distance";

/* ───────────────────────────── event timing ─────────────────────────────
   Naive-local ISO in, a "when is this" verdict out. Mirrors the deal status
   machine so events and happy hours read off the same mental model. */

export type EventState =
  | "LIVE_NOW"
  | "TONIGHT"
  | "TOMORROW"
  | "THIS_WEEK"
  | "UPCOMING"
  | "ENDED";

export interface EventTiming {
  state: EventState;
  /** minutes until doors (null once started). */
  startsInMin: number | null;
  /** minutes until it's over (only while LIVE_NOW). */
  endsInMin: number | null;
  start: Date;
  end: Date;
  label: string;
}

const DEFAULT_DURATION_MIN = 180;
const WEEK_MIN = 7 * 24 * 60;

/** A naive ISO ("2026-06-11T19:05:00") parses as local time — exactly right
 *  for "now" on the user's device. */
function parseLocal(iso: string): Date {
  return new Date(iso);
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
const DOW_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function formatEventTime(d: Date): string {
  return TIME_FMT.format(d).replace(/\s/, "").toLowerCase(); // "7:05pm"
}

function buildLabel(start: Date, state: EventState): string {
  const t = formatEventTime(start);
  switch (state) {
    case "TONIGHT":
      return `Tonight · ${t}`;
    case "TOMORROW":
      return `Tomorrow · ${t}`;
    case "THIS_WEEK":
      return `${DOW_FMT.format(start)} · ${t}`;
    default:
      return `${DATE_FMT.format(start)} · ${t}`;
  }
}

export function eventTiming(ev: CityEvent, now: Date): EventTiming {
  const start = parseLocal(ev.start);
  const end = ev.end
    ? parseLocal(ev.end)
    : new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000);
  const ms = now.getTime();
  const startsInMin = Math.round((start.getTime() - ms) / 60_000);
  const endsInMin = Math.round((end.getTime() - ms) / 60_000);

  if (ms >= end.getTime()) {
    return { state: "ENDED", startsInMin: null, endsInMin: null, start, end, label: "Ended" };
  }
  if (ms >= start.getTime()) {
    return {
      state: "LIVE_NOW",
      startsInMin: null,
      endsInMin,
      start,
      end,
      label: "Happening now",
    };
  }
  const tomorrow = new Date(ms + 86_400_000);
  let state: EventState;
  if (sameLocalDay(start, now)) state = "TONIGHT";
  else if (sameLocalDay(start, tomorrow)) state = "TOMORROW";
  else if (startsInMin <= WEEK_MIN) state = "THIS_WEEK";
  else state = "UPCOMING";
  return { state, startsInMin, endsInMin: null, start, end, label: buildLabel(start, state) };
}

export interface RankedEvent {
  event: CityEvent;
  timing: EventTiming;
}

/** Live first, then soonest — ended events dropped. */
export function rankEvents(events: CityEvent[], now: Date): RankedEvent[] {
  return events
    .map((event) => ({ event, timing: eventTiming(event, now) }))
    .filter((r) => r.timing.state !== "ENDED")
    .sort((a, b) => {
      const al = a.timing.state === "LIVE_NOW" ? 0 : 1;
      const bl = b.timing.state === "LIVE_NOW" ? 0 : 1;
      if (al !== bl) return al - bl;
      return a.timing.start.getTime() - b.timing.start.getTime();
    });
}

/* ─────────────────────── the seamless bit: pre-game drinks ───────────────────
   For any event, the cheapest pours you can reach beforehand. Within an easy
   walk we sort cheapest-first (the app's whole thesis); if the event sits far
   from any tracked deal we backfill with the nearest cheap pours so the list is
   never empty. */

export interface PregameDeal {
  ranked: RankedVenue;
  meters: number;
  walkMin: number;
}

const EASY_WALK_MIN = 18;

function cheapestFirst(a: PregameDeal, b: PregameDeal): number {
  const ap = a.ranked.cheapestDrink ?? Infinity;
  const bp = b.ranked.cheapestDrink ?? Infinity;
  if (ap !== bp) return ap - bp;
  return a.walkMin - b.walkMin;
}

export function pregameDeals(
  ev: CityEvent,
  ranked: RankedVenue[],
  limit = 4
): PregameDeal[] {
  const candidates: PregameDeal[] = [];
  for (const r of ranked) {
    if (r.venue.lat == null || r.venue.lng == null) continue;
    if (r.venue.lifecycle !== "EXTRACTED") continue;
    if (r.cheapestDrink == null) continue;
    const meters = haversineMeters(ev.lat, ev.lng, r.venue.lat, r.venue.lng);
    candidates.push({ ranked: r, meters, walkMin: walkMinutes(meters) });
  }
  const near = candidates.filter((c) => c.walkMin <= EASY_WALK_MIN).sort(cheapestFirst);
  if (near.length >= limit) return near.slice(0, limit);
  // backfill far events with the nearest cheap pours so the list always lands
  const far = candidates
    .filter((c) => c.walkMin > EASY_WALK_MIN)
    .sort((a, b) => a.meters - b.meters);
  return [...near, ...far].slice(0, limit);
}
