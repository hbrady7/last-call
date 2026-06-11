import type { Deal } from "../types";
import {
  chicagoNow,
  parseHHmm,
  MINUTES_PER_DAY,
  MINUTES_PER_WEEK,
} from "./time";

export type DealState = "LIVE" | "STARTS_SOON" | "LATER_TODAY" | "NOT_TODAY";

export interface DealStatus {
  state: DealState;
  /** minutes remaining in a LIVE window (null if open-ended). */
  endsInMin: number | null;
  /** minutes until the next start (STARTS_SOON / LATER_TODAY). */
  startsInMin: number | null;
}

/** all_day deals count as LIVE 11:00–02:00 every day. */
const ALL_DAY_START = 11 * 60; // 660
const ALL_DAY_END = 2 * 60; // 120, next day (crosses midnight)
const SOON_THRESHOLD = 90;

interface Window {
  /** week-minute of the start, [0, 10080) */
  start: number;
  /** week-minute of the end, may exceed 10080 when crossing the week boundary */
  end: number;
}

function buildWindows(deal: Deal): Window[] {
  const windows: Window[] = [];
  if (deal.kind === "all_day") {
    const days = deal.days.length ? deal.days : [0, 1, 2, 3, 4, 5, 6];
    for (const d of days) {
      const start = d * MINUTES_PER_DAY + ALL_DAY_START;
      const end = d * MINUTES_PER_DAY + MINUTES_PER_DAY + ALL_DAY_END; // +1 day
      windows.push({ start, end });
    }
    return windows;
  }
  if (deal.startTime == null || deal.endTime == null) return windows;
  const s = parseHHmm(deal.startTime);
  let e = parseHHmm(deal.endTime);
  if (e <= s) e += MINUTES_PER_DAY; // crosses midnight
  for (const d of deal.days) {
    const start = d * MINUTES_PER_DAY + s;
    const end = d * MINUTES_PER_DAY + e;
    windows.push({ start, end });
  }
  return windows;
}

export function getDealStatus(deal: Deal, now: Date): DealStatus {
  const { weekMinute } = chicagoNow(now);
  const windows = buildWindows(deal);

  // LIVE: is now inside any window? Test both the raw position and the
  // wrapped-by-a-week position so Saturday-night → Sunday windows are caught.
  let liveEndsIn: number | null = null;
  for (const w of windows) {
    for (const pos of [weekMinute, weekMinute + MINUTES_PER_WEEK]) {
      if (pos >= w.start && pos < w.end) {
        const remaining = w.end - pos;
        liveEndsIn =
          liveEndsIn == null ? remaining : Math.min(liveEndsIn, remaining);
      }
    }
  }
  if (liveEndsIn != null) {
    return { state: "LIVE", endsInMin: Math.max(0, Math.round(liveEndsIn)), startsInMin: null };
  }

  // Not live: find the soonest upcoming start.
  let soonest = Infinity;
  for (const w of windows) {
    const delta = ((w.start - weekMinute) % MINUTES_PER_WEEK + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
    if (delta > 0 && delta < soonest) soonest = delta;
  }
  if (!isFinite(soonest)) {
    return { state: "NOT_TODAY", endsInMin: null, startsInMin: null };
  }

  const startsInMin = Math.round(soonest);
  const nowWeekday = Math.floor(weekMinute / MINUTES_PER_DAY);
  const startWeekday = Math.floor(
    ((weekMinute + soonest) % MINUTES_PER_WEEK) / MINUTES_PER_DAY
  );

  if (soonest < SOON_THRESHOLD) {
    return { state: "STARTS_SOON", endsInMin: null, startsInMin };
  }
  if (startWeekday === nowWeekday) {
    return { state: "LATER_TODAY", endsInMin: null, startsInMin };
  }
  return { state: "NOT_TODAY", endsInMin: null, startsInMin };
}

/** Best (most "live") status across a venue's deals. */
const RANK: Record<DealState, number> = {
  LIVE: 3,
  STARTS_SOON: 2,
  LATER_TODAY: 1,
  NOT_TODAY: 0,
};

export function bestStatus(
  deals: Deal[],
  now: Date
): { deal: Deal; status: DealStatus } | null {
  let best: { deal: Deal; status: DealStatus } | null = null;
  for (const deal of deals) {
    const status = getDealStatus(deal, now);
    if (!best || RANK[status.state] > RANK[best.status.state]) {
      best = { deal, status };
    } else if (
      RANK[status.state] === RANK[best.status.state] &&
      status.state === "LIVE" &&
      (status.endsInMin ?? 0) > (best.status.endsInMin ?? 0)
    ) {
      // Among LIVE deals prefer the one with more time left on the clock.
      best = { deal, status };
    }
  }
  return best;
}
