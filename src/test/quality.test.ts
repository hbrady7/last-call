import { describe, it, expect } from "vitest";
import type { Deal, VenueWithDeals } from "../lib/types";
import { rankVenues } from "../lib/engine/rank";
import { liveStats, liveStatsLine } from "../lib/engine/stats";
import { cheapestDrinkPrice } from "../lib/engine/score";
import { voice, daySeed } from "../lib/voice";

function deal(partial: Partial<Deal>): Deal {
  return {
    id: "d",
    venueId: "v",
    kind: "all_day",
    days: [0, 1, 2, 3, 4, 5, 6],
    startTime: null,
    endTime: null,
    items: [{ label: "Old Style", price: 4, category: "beer" }],
    finePrint: null,
    sourceUrl: null,
    confidence: 1,
    lastVerified: "2026-06-10T12:00:00.000Z",
    ...partial,
  };
}

function venue(id: string, deals: Deal[], lat = 41.8886, lng = -87.6276): VenueWithDeals {
  return {
    id,
    slug: id,
    name: id,
    address: null,
    neighborhood: "Loop",
    lat,
    lng,
    class: "bar",
    lifecycle: "EXTRACTED",
    website: null,
    dealSourceUrl: null,
    tags: [],
    cashOnly: false,
    distanceFromHqM: null,
    deals,
  };
}

const HQ = { lat: 41.8886592, lng: -87.627596 };
// a Wednesday inside the all_day live window (noon)
const NOON = new Date("2026-06-10T12:00:00-05:00");

describe("needsReview excludes flagged intel from scoring", () => {
  it("a flagged deal does not set the cheapest-drink key", () => {
    const flagged = deal({ items: [{ label: "Beer", price: 1, category: "beer" }], needsReview: true });
    const good = deal({ items: [{ label: "Beer", price: 5, category: "beer" }] });
    expect(cheapestDrinkPrice([flagged, good])).toBe(5);
    expect(cheapestDrinkPrice([flagged])).toBeNull();
  });
});

describe("liveStats — status-aware truth", () => {
  it("counts live now + within a 10-min walk", () => {
    const ranked = rankVenues(
      [venue("near", [deal({})], HQ.lat, HQ.lng), venue("far", [deal({})], 41.95, -87.65)],
      NOON,
      HQ
    );
    const s = liveStats(ranked);
    expect(s.liveNow).toBe(2);
    expect(s.liveWithin10).toBe(1); // only the on-HQ venue is within 10 min
    expect(liveStatsLine(s)).toContain("live now");
  });

  it("reads honestly when nothing is live", () => {
    const ranked = rankVenues([venue("v", [])], NOON, HQ);
    expect(liveStats(ranked).liveNow).toBe(0);
  });
});

describe("voice — deterministic, day-seeded", () => {
  it("returns the same line all day, may differ across days", () => {
    const a = voice.emptyNoLive(new Date("2026-06-10T19:00:00"));
    const b = voice.emptyNoLive(new Date("2026-06-10T23:30:00"));
    expect(a).toBe(b);
    expect(daySeed(new Date("2026-06-10T01:00:00"))).toBe(20260610);
  });
});
