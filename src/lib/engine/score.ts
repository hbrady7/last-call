import type { Deal, DealCategory } from "../types";
import { parseHHmm, MINUTES_PER_DAY } from "./time";

/** Typical full-price Chicago anchors, in dollars, per category. */
export const BASELINES: Record<DealCategory, number> = {
  beer: 8,
  wine: 14,
  cocktail: 16,
  shot: 9,
  food: 15,
};

const DRINK_CATEGORIES: DealCategory[] = ["beer", "wine", "cocktail", "shot"];

/** Window length in hours, honoring midnight-crossing happy hours. */
export function windowHours(deal: Deal): number {
  if (deal.kind === "all_day") return 4; // treated as full credit below
  if (deal.startTime == null || deal.endTime == null) return 0;
  const s = parseHHmm(deal.startTime);
  let e = parseHHmm(deal.endTime);
  if (e <= s) e += MINUTES_PER_DAY;
  return (e - s) / 60;
}

/**
 * Steal Score, 0–100.
 *  45 — avg discount depth  avg(max(0, 1 − price/baseline)) over priced items
 *  20 — breadth             min(items, 8) / 8
 *  15 — window              min(hours, 4) / 4   (all_day = full 15)
 *  20 — anchor              any drink ≤ $5 → 20, ≤ $6 → 12, else 0
 */
export function scoreDeal(deal: Deal): number {
  const priced = deal.items.filter((i) => i.price != null);
  const depth =
    priced.length > 0
      ? priced.reduce(
          (sum, i) =>
            sum + Math.max(0, 1 - (i.price as number) / BASELINES[i.category]),
          0
        ) / priced.length
      : 0;
  const depthPts = depth * 45;

  const breadthPts = (Math.min(deal.items.length, 8) / 8) * 20;

  const windowPts =
    deal.kind === "all_day" ? 15 : (Math.min(windowHours(deal), 4) / 4) * 15;

  const cheapestDrink = priced
    .filter((i) => DRINK_CATEGORIES.includes(i.category))
    .reduce(
      (min, i) => Math.min(min, i.price as number),
      Number.POSITIVE_INFINITY
    );
  let anchorPts = 0;
  if (cheapestDrink <= 5) anchorPts = 20;
  else if (cheapestDrink <= 6) anchorPts = 12;

  const total = depthPts + breadthPts + windowPts + anchorPts;
  return Math.max(0, Math.min(100, Math.round(total)));
}

/** A venue's headline score = the best score among its deals. */
export function scoreVenue(deals: Deal[]): number {
  if (deals.length === 0) return 0;
  return Math.max(...deals.map(scoreDeal));
}

/**
 * The single cheapest priced *drink* across every one of a venue's deals
 * (food excluded). This is the primary ranking key — the loudest answer to
 * "where's the cheapest pour right now." null when no drink carries a price.
 */
export function cheapestDrinkPrice(deals: Deal[]): number | null {
  let min = Number.POSITIVE_INFINITY;
  for (const d of deals) {
    for (const i of d.items) {
      if (i.price != null && DRINK_CATEGORIES.includes(i.category)) {
        min = Math.min(min, i.price);
      }
    }
  }
  return Number.isFinite(min) ? min : null;
}
