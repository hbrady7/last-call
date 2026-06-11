import type { RankedVenue } from "./rank";
import type { FilterKey } from "@/store/useStore";

function hasCategory(r: RankedVenue, cat: string): boolean {
  return r.venue.deals.some((d) => d.items.some((i) => i.category === cat));
}

const PREDICATES: Record<FilterKey, (r: RankedVenue) => boolean> = {
  live: (r) => r.status.state === "LIVE",
  beer: (r) => hasCategory(r, "beer"),
  cocktails: (r) => hasCategory(r, "cocktail"),
  food: (r) => hasCategory(r, "food"),
  dives: (r) => r.venue.tags.includes("dive"),
  walk15: (r) => r.walkMin != null && r.walkMin <= 15,
  patio: (r) => r.venue.tags.includes("patio"),
};

/** AND across every active filter chip. */
export function applyFilters(
  ranked: RankedVenue[],
  filters: FilterKey[]
): RankedVenue[] {
  if (filters.length === 0) return ranked;
  return ranked.filter((r) => filters.every((f) => PREDICATES[f](r)));
}
