import type { VenueWithDeals, Deal, DealItem } from "../types";
import { getDealStatus } from "./status";
import { scoreDeal } from "./score";
import { haversineMeters, walkMinutes } from "./distance";
import { formatMinuteOfDay, chicagoNow } from "./time";

const DWELL_MIN = 45; // how long you linger per stop
const MIN_REMAINING = 20; // a window must have ≥20 min left when you arrive
const BEAM_WIDTH = 5;

export interface PlanInput {
  start: { lat: number; lng: number };
  startAt: Date;
  stops: number; // 2–4
  maxWalkMin: number;
  budget: number | null;
  /** vibe tags: 'dives' | 'cocktails' | 'patio' | 'live-music' | 'food' */
  vibes: string[];
  /** venue ids to exclude (used by "shuffle" to force a different run). */
  exclude?: string[];
}

export interface PlanStop {
  venue: VenueWithDeals;
  deal: Deal;
  arriveAt: Date;
  leaveAt: Date;
  walkMin: number;
  pick: DealItem | null;
  stealScore: number;
}

export interface Itinerary {
  stops: PlanStop[];
  totalWalkMin: number;
  totalDamage: number;
  budget: number | null;
  withinBudget: boolean;
  intro: string;
}

function cheapestDrink(deal: Deal): DealItem | null {
  const drinks = deal.items.filter((i) => i.price != null && i.category !== "food");
  if (drinks.length === 0) return null;
  return drinks.reduce((a, b) => ((a.price as number) <= (b.price as number) ? a : b));
}

/** The best LIVE deal at a given arrival instant, with ≥MIN_REMAINING left. */
function liveDealAt(venue: VenueWithDeals, at: Date): { deal: Deal; endsIn: number } | null {
  let best: { deal: Deal; endsIn: number } | null = null;
  for (const d of venue.deals) {
    const s = getDealStatus(d, at);
    if (s.state !== "LIVE") continue;
    const endsIn = s.endsInMin ?? 999;
    if (endsIn < MIN_REMAINING) continue;
    if (!best || endsIn > best.endsIn) best = { deal: d, endsIn };
  }
  return best;
}

function matchesVibes(venue: VenueWithDeals, vibes: string[]): boolean {
  if (vibes.length === 0) return true;
  return vibes.some((v) => {
    if (v === "dives") return venue.tags.includes("dive");
    if (v === "patio") return venue.tags.includes("patio");
    if (v === "live-music") return venue.tags.includes("live-music");
    if (v === "cocktails")
      return venue.deals.some((d) => d.items.some((i) => i.category === "cocktail"));
    if (v === "food")
      return venue.deals.some((d) => d.items.some((i) => i.category === "food"));
    return false;
  });
}

interface Beam {
  stops: PlanStop[];
  lat: number;
  lng: number;
  time: Date;
  score: number;
  visited: Set<string>;
}

/**
 * Beam search (width 5) over EXTRACTED venues. Each leg's candidates are venues
 * reachable within maxWalk whose deal is live on arrival with ≥20 min left;
 * leg score = stealScore × windowFit − walkPenalty. all_day dives are universal
 * late-leg gap-fillers (their window spans the whole night).
 */
export function planNight(
  venues: VenueWithDeals[],
  input: PlanInput
): Itinerary | null {
  const excluded = new Set(input.exclude ?? []);
  const pool = venues.filter(
    (v) =>
      v.lifecycle === "EXTRACTED" &&
      v.lat != null &&
      v.lng != null &&
      !excluded.has(v.id) &&
      matchesVibes(v, input.vibes)
  );

  let beams: Beam[] = [
    {
      stops: [],
      lat: input.start.lat,
      lng: input.start.lng,
      time: input.startAt,
      score: 0,
      visited: new Set(),
    },
  ];

  for (let leg = 0; leg < input.stops; leg++) {
    const next: Beam[] = [];
    for (const beam of beams) {
      for (const v of pool) {
        if (beam.visited.has(v.id)) continue;
        const walk = walkMinutes(
          haversineMeters(beam.lat, beam.lng, v.lat as number, v.lng as number)
        );
        if (walk > input.maxWalkMin) continue;
        const arriveAt = new Date(beam.time.getTime() + walk * 60_000);
        const live = liveDealAt(v, arriveAt);
        if (!live) continue;
        const steal = scoreDeal(live.deal);
        const windowFit =
          live.deal.kind === "all_day" ? 1 : Math.min(live.endsIn, DWELL_MIN) / DWELL_MIN;
        const legScore = steal * windowFit - walk * 1.5;
        const leaveAt = new Date(arriveAt.getTime() + DWELL_MIN * 60_000);
        next.push({
          stops: [
            ...beam.stops,
            {
              venue: v,
              deal: live.deal,
              arriveAt,
              leaveAt,
              walkMin: Math.round(walk),
              pick: cheapestDrink(live.deal),
              stealScore: steal,
            },
          ],
          lat: v.lat as number,
          lng: v.lng as number,
          time: leaveAt,
          score: beam.score + legScore,
          visited: new Set([...beam.visited, v.id]),
        });
      }
    }
    if (next.length === 0) break;
    next.sort((a, b) => b.score - a.score);
    beams = next.slice(0, BEAM_WIDTH);
  }

  const complete = beams.filter((b) => b.stops.length === input.stops);
  const best =
    (complete.length ? complete : beams)
      .filter((b) => b.stops.length >= 2)
      .sort((a, b) => b.score - a.score)[0] ?? null;
  if (!best || best.stops.length === 0) return null;

  // Damage: 2 drinks/stop × cheapest anchor (+ a food item if budget allows).
  let totalDamage = 0;
  for (const s of best.stops) {
    totalDamage += 2 * (s.pick?.price ?? 0);
    if (input.budget != null) {
      const food = s.deal.items.find((i) => i.price != null && i.category === "food");
      if (food && totalDamage + (food.price as number) <= input.budget) {
        totalDamage += food.price as number;
      }
    }
  }
  const totalWalkMin = best.stops.reduce((a, s) => a + s.walkMin, 0);
  const withinBudget = input.budget == null || totalDamage <= input.budget;

  return {
    stops: best.stops,
    totalWalkMin,
    totalDamage,
    budget: input.budget,
    withinBudget,
    intro: templatedIntro(best.stops, input.startAt, totalDamage),
  };
}

function templatedIntro(stops: PlanStop[], startAt: Date, damage: number): string {
  const names = stops.map((s) => s.venue.name);
  const first = formatMinuteOfDay(chicagoNow(startAt).minuteOfDay);
  const last = names[names.length - 1];
  return `${stops.length} stops starting ${first}, landing at ${last} — roughly $${damage} of damage. Hydrate between rounds.`;
}

/** Plain-text share block for an itinerary. */
export function itineraryText(it: Itinerary): string {
  const lines = it.stops.map((s, i) => {
    const pick = s.pick ? `$${s.pick.price} ${s.pick.label}` : s.venue.name;
    const t = formatMinuteOfDay(chicagoNow(s.arriveAt).minuteOfDay);
    return `${i + 1}. ${t} — ${s.venue.name} · order ${pick}`;
  });
  return [
    "🍸 MY NIGHT — planned with LAST CALL",
    ...lines,
    `~${it.totalWalkMin} min walking · ~$${it.totalDamage} damage`,
  ].join("\n");
}
