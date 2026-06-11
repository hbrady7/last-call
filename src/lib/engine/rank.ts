import type { Deal, VenueWithDeals } from "../types";
import { bestStatus, getDealStatus, type DealState, type DealStatus } from "./status";
import { scoreDeal } from "./score";
import { haversineMeters, walkMinutes } from "./distance";

export const STATUS_WEIGHT: Record<DealState, number> = {
  LIVE: 1.0,
  STARTS_SOON: 0.8,
  LATER_TODAY: 0.5,
  NOT_TODAY: 0.2,
};

export interface RankedVenue {
  venue: VenueWithDeals;
  status: DealStatus;
  /** the deal driving the status/headline (best-status deal). */
  headlineDeal: Deal | null;
  score: number;
  meters: number | null;
  walkMin: number | null;
  rankValue: number;
  headline: string;
  /** lastVerified is stale (>45 days) or confidence < 0.6. */
  stale: boolean;
}

const STALE_DAYS = 45;

function headlineFor(deal: Deal | null): string {
  if (!deal) return "No deal info";
  const priced = deal.items.filter((i) => i.price != null);
  if (priced.length === 0) {
    return deal.items[0]?.label ?? deal.finePrint ?? "Deal";
  }
  // Lead with the cheapest item — the loudest hook.
  const cheapest = priced.reduce((a, b) =>
    (a.price as number) <= (b.price as number) ? a : b
  );
  return `$${cheapest.price} ${cheapest.label}`;
}

function isStale(deal: Deal | null, now: Date): boolean {
  if (!deal) return false;
  if (deal.confidence < 0.6) return true;
  const ageDays =
    (now.getTime() - new Date(deal.lastVerified).getTime()) / 86_400_000;
  return ageDays > STALE_DAYS;
}

export function rankVenue(
  venue: VenueWithDeals,
  now: Date,
  user: { lat: number; lng: number } | null
): RankedVenue {
  const best = bestStatus(venue.deals, now);
  const status: DealStatus = best?.status ?? {
    state: "NOT_TODAY",
    endsInMin: null,
    startsInMin: null,
  };
  const headlineDeal = best?.deal ?? null;
  const score = headlineDeal ? scoreDeal(headlineDeal) : 0;

  let meters: number | null = null;
  let walkMin: number | null = null;
  if (user && venue.lat != null && venue.lng != null) {
    meters = haversineMeters(user.lat, user.lng, venue.lat, venue.lng);
    walkMin = walkMinutes(meters);
  }

  const rankValue =
    score * STATUS_WEIGHT[status.state] - 1.5 * (walkMin ?? 0);

  return {
    venue,
    status,
    headlineDeal,
    score,
    meters,
    walkMin,
    rankValue,
    headline: headlineFor(headlineDeal),
    stale: isStale(headlineDeal, now),
  };
}

export function rankVenues(
  venues: VenueWithDeals[],
  now: Date,
  user: { lat: number; lng: number } | null
): RankedVenue[] {
  return venues
    .map((v) => rankVenue(v, now, user))
    .sort((a, b) => b.rankValue - a.rankValue);
}

/** Re-export for callers that only need a single deal's status. */
export { getDealStatus };
