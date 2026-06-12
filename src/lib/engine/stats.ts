import type { RankedVenue } from "./rank";

export interface LiveStats {
  /** venues with a LIVE deal right now */
  liveNow: number;
  /** of those, how many are within a 10-minute walk of the anchor */
  liveWithin10: number;
  /** total venues we actually have priced deals for (EXTRACTED w/ a pour) */
  withDeals: number;
}

const WALK_MIN_NEAR = 10;

/**
 * Status-aware truth for the header — replaces the vanity "N deals" census
 * count with what's actually actionable this minute. Honest by construction:
 * `liveNow` is a real status-machine count, `liveWithin10` needs a walk time
 * (so it's 0 until there's an anchor distance).
 */
export function liveStats(ranked: RankedVenue[]): LiveStats {
  let liveNow = 0;
  let liveWithin10 = 0;
  let withDeals = 0;
  for (const r of ranked) {
    if (r.cheapestDrink != null) withDeals++;
    if (r.status.state === "LIVE") {
      liveNow++;
      if (r.walkMin != null && r.walkMin <= WALK_MIN_NEAR) liveWithin10++;
    }
  }
  return { liveNow, liveWithin10, withDeals };
}

/** Human one-liner for the header. Falls back gracefully with no anchor. */
export function liveStatsLine(s: LiveStats): string {
  if (s.liveNow === 0) {
    return s.withDeals > 0 ? "Nothing live · next window soon" : "Scouting the city…";
  }
  const live = `${s.liveNow} live now`;
  if (s.liveWithin10 > 0) return `${live} · ${s.liveWithin10} within a 10-min walk`;
  return live;
}
