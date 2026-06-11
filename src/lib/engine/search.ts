import type { RankedVenue } from "./rank";
import type { DealCategory } from "../types";

export interface SearchFilter {
  category?: DealCategory;
  maxPrice?: number;
  liveNow?: boolean;
  tags: string[];
  text?: string;
}

const CATEGORY_WORDS: Record<string, DealCategory> = {
  martini: "cocktail",
  martinis: "cocktail",
  cocktail: "cocktail",
  cocktails: "cocktail",
  well: "cocktail",
  wells: "cocktail",
  beer: "beer",
  beers: "beer",
  draft: "beer",
  drafts: "beer",
  lager: "beer",
  pint: "beer",
  pints: "beer",
  tallboy: "beer",
  tallboys: "beer",
  wine: "wine",
  sake: "wine",
  shot: "shot",
  shots: "shot",
  food: "food",
  snack: "food",
  snacks: "food",
  bite: "food",
  bites: "food",
};

/**
 * Tiny phrase parser: "martinis under $8", "patio now", "dive open late",
 * "cocktails at 7". Always client-side and keyless. (An optional Haiku parse
 * could refine this when a key is present; the keyword path is the floor.)
 */
export function parseQuery(raw: string): SearchFilter {
  const q = raw.toLowerCase().trim();
  const f: SearchFilter = { tags: [] };
  if (!q) return f;

  // price: "$8", "under 8", "below $10", "< 6"
  const price = q.match(/(?:under|below|less than|<|≤|\bfor\b)?\s*\$\s*(\d+)/);
  const priceNoSign = q.match(/(?:under|below|less than)\s+(\d+)/);
  if (price) f.maxPrice = parseInt(price[1], 10);
  else if (priceNoSign) f.maxPrice = parseInt(priceNoSign[1], 10);

  for (const [word, cat] of Object.entries(CATEGORY_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(q)) {
      f.category = cat;
      break;
    }
  }

  if (/\b(now|open|live|right now|tonight)\b/.test(q)) f.liveNow = true;
  if (/\bpatio\b/.test(q)) f.tags.push("patio");
  if (/\bdives?\b/.test(q)) f.tags.push("dive");
  if (/\blive music\b/.test(q)) f.tags.push("live-music");

  // leftover words → freeform name match
  const stop = new Set([
    "under","below","less","than","at","now","open","live","tonight","right",
    "patio","dive","dives","music","with","the","near","for","and","cheap","deal","deals","happy","hour",
    "late","early","til","till","until","close","closing","spot","bar","place","drink","drinks","good","best",
    ...Object.keys(CATEGORY_WORDS),
  ]);
  const leftover = q
    .replace(/\$?\s*\d+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
  if (leftover.length) f.text = leftover.join(" ");

  return f;
}

export function applySearch(
  ranked: RankedVenue[],
  f: SearchFilter
): RankedVenue[] {
  const empty = !f.category && f.maxPrice == null && !f.liveNow && f.tags.length === 0 && !f.text;
  if (empty) return ranked;

  return ranked.filter((r) => {
    if (f.liveNow && r.status.state !== "LIVE") return false;
    if (f.tags.length && !f.tags.every((t) => r.venue.tags.includes(t))) return false;
    if (f.text && !r.venue.name.toLowerCase().includes(f.text)) return false;

    if (f.category || f.maxPrice != null) {
      const items = r.venue.deals.flatMap((d) => d.items);
      const ok = items.some((i) => {
        if (f.category && i.category !== f.category) return false;
        if (f.maxPrice != null && (i.price == null || i.price > f.maxPrice)) return false;
        // when only a price is given, restrict to drinks
        if (!f.category && f.maxPrice != null && i.category === "food") return false;
        return true;
      });
      if (!ok) return false;
    }
    return true;
  });
}
