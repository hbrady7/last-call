import type { RankedVenue } from "./rank";
import type { DealItem } from "../types";

/* ─────────────────────────── THE HANDSHAKE INDEX ──────────────────────────
   Chicago's Dow Jones: the cheapest "Old Style + Malört" combo live right now.
   The shot-and-a-beer is the city's actual handshake. We prefer literal Old
   Style + Malört by label; if a venue hasn't named them, we fall back to its
   cheapest live domestic-ish beer + cheapest live shot, and label honestly. */

export interface Handshake {
  venue: RankedVenue["venue"];
  beer: DealItem;
  shot: DealItem;
  total: number;
  /** true when both items literally name Old Style + Malört. */
  exact: boolean;
}

function findItem(
  items: DealItem[],
  category: DealItem["category"],
  needle: RegExp
): { item: DealItem | null; exact: boolean } {
  const priced = items.filter((i) => i.price != null && i.category === category);
  if (priced.length === 0) return { item: null, exact: false };
  const named = priced.find((i) => needle.test(i.label));
  if (named) return { item: named, exact: true };
  const cheapest = priced.reduce((a, b) => ((a.price as number) <= (b.price as number) ? a : b));
  return { item: cheapest, exact: false };
}

/** Cheapest live beer+shot combo from a single venue within the ranked set. */
export function handshakeIndex(ranked: RankedVenue[]): Handshake | null {
  let best: Handshake | null = null;
  for (const r of ranked) {
    if (r.status.state !== "LIVE") continue;
    const items = r.headlineDeal?.items ?? [];
    const beer = findItem(items, "beer", /old\s*style/i);
    const shot = findItem(items, "shot", /mal[öo]rt/i);
    if (!beer.item || !shot.item) continue;
    const total = (beer.item.price as number) + (shot.item.price as number);
    const exact = beer.exact && shot.exact;
    if (!best || total < best.total || (total === best.total && exact && !best.exact)) {
      best = { venue: r.venue, beer: beer.item, shot: shot.item, total, exact };
    }
  }
  return best;
}
