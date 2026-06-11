import type { RankedVenue } from "./rank";
import type { DealItem } from "../types";
import { haversineMeters, walkMinutes } from "./distance";
import { formatMinuteOfDay } from "./time";
import { chicagoNow } from "./time";

export interface PlayStop {
  ranked: RankedVenue;
  /** minutes from now until you arrive (cumulative walking). */
  arriveInMin: number;
  /** representative drink to order here. */
  pick: DealItem | null;
}

export interface TonightsPlay {
  stops: PlayStop[];
  totalWalkMin: number;
  totalDamage: number;
  text: string;
}

const MAX_STOPS = 3;
const MAX_HOP_MIN = 14; // don't send someone on a death march between bars

function cheapestDrink(r: RankedVenue): DealItem | null {
  const items = r.headlineDeal?.items ?? [];
  const drinks = items.filter(
    (i) => i.price != null && i.category !== "food"
  );
  if (drinks.length === 0) return null;
  return drinks.reduce((a, b) => ((a.price ?? 0) <= (b.price ?? 0) ? a : b));
}

/**
 * Greedily chain the best 2–3 LIVE stops for right now: start at the
 * top-ranked live deal, then hop to the nearest still-live bar each time,
 * respecting walking time so you arrive while the window is open.
 */
export function planTonight(
  ranked: RankedVenue[],
  now: Date
): TonightsPlay | null {
  const live = ranked.filter(
    (r) =>
      r.status.state === "LIVE" &&
      r.venue.lat != null &&
      r.venue.lng != null &&
      r.walkMin != null
  );
  if (live.length === 0) return null;

  const remaining = [...live].sort((a, b) => b.rankValue - a.rankValue);
  const first = remaining.shift()!;
  let elapsed = first.walkMin ?? 0;
  const stops: PlayStop[] = [
    { ranked: first, arriveInMin: Math.round(elapsed), pick: cheapestDrink(first) },
  ];
  let curLat = first.venue.lat!;
  let curLng = first.venue.lng!;

  while (stops.length < MAX_STOPS && remaining.length > 0) {
    remaining.sort(
      (a, b) =>
        haversineMeters(curLat, curLng, a.venue.lat!, a.venue.lng!) -
        haversineMeters(curLat, curLng, b.venue.lat!, b.venue.lng!)
    );
    let chosenIdx = -1;
    for (let i = 0; i < remaining.length; i++) {
      const r = remaining[i];
      const hop = walkMinutes(
        haversineMeters(curLat, curLng, r.venue.lat!, r.venue.lng!)
      );
      if (hop > MAX_HOP_MIN) continue;
      const stillLive =
        r.status.endsInMin == null || r.status.endsInMin > elapsed + hop;
      if (stillLive) {
        chosenIdx = i;
        elapsed += hop;
        break;
      }
    }
    if (chosenIdx === -1) break;
    const [chosen] = remaining.splice(chosenIdx, 1);
    stops.push({
      ranked: chosen,
      arriveInMin: Math.round(elapsed),
      pick: cheapestDrink(chosen),
    });
    curLat = chosen.venue.lat!;
    curLng = chosen.venue.lng!;
  }

  const totalDamage = stops.reduce((sum, s) => sum + (s.pick?.price ?? 0), 0);
  const totalWalkMin = Math.round(elapsed);

  return {
    stops,
    totalWalkMin,
    totalDamage,
    text: buildShareText(stops, now, totalWalkMin, totalDamage),
  };
}

function buildShareText(
  stops: PlayStop[],
  now: Date,
  totalWalkMin: number,
  totalDamage: number
): string {
  const lines = stops.map((s, i) => {
    const pick = s.pick ? `$${s.pick.price} ${s.pick.label}` : s.ranked.headline;
    const end =
      s.ranked.status.endsInMin != null
        ? ` (live til ${formatMinuteOfDay(
            chicagoNow(now).minuteOfDay + s.ranked.status.endsInMin
          )})`
        : "";
    return `${i + 1}. ${s.ranked.venue.name} — ${pick}${end}`;
  });
  return [
    "🍺 TONIGHT'S PLAY — via LAST CALL",
    ...lines,
    `~${totalWalkMin} min walking · ~$${totalDamage} damage`,
  ].join("\n");
}
