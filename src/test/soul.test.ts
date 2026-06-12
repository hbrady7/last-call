import { describe, it, expect } from "vitest";
import type { Deal, VenueWithDeals, CityEvent } from "../lib/types";
import { rankVenues } from "../lib/engine/rank";
import { handshakeIndex } from "../lib/engine/handshake";
import { gameDayVenueIds } from "../lib/engine/gameday";
import { pregameDeals } from "../lib/engine/events";

function deal(items: Deal["items"]): Deal {
  return {
    id: "d",
    venueId: "v",
    kind: "all_day",
    days: [0, 1, 2, 3, 4, 5, 6],
    startTime: null,
    endTime: null,
    items,
    finePrint: null,
    sourceUrl: null,
    confidence: 1,
    lastVerified: "2026-06-10T12:00:00.000Z",
  };
}

function venue(id: string, deals: Deal[], lat: number, lng: number): VenueWithDeals {
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
const NOON = new Date("2026-06-10T12:00:00-05:00");
const WRIGLEY = { lat: 41.9484, lng: -87.6553 };

describe("handshake index", () => {
  it("finds the cheapest live beer+shot combo and flags exact matches", () => {
    const ranked = rankVenues(
      [
        venue(
          "skylark",
          [deal([
            { label: "Old Style", price: 3, category: "beer" },
            { label: "Malört", price: 4, category: "shot" },
          ])],
          HQ.lat,
          HQ.lng
        ),
      ],
      NOON,
      HQ
    );
    const h = handshakeIndex(ranked);
    expect(h).not.toBeNull();
    expect(h!.total).toBe(7);
    expect(h!.exact).toBe(true);
  });

  it("returns null when no venue has both a beer and a shot", () => {
    const ranked = rankVenues(
      [venue("beeronly", [deal([{ label: "Lager", price: 4, category: "beer" }])], HQ.lat, HQ.lng)],
      NOON,
      HQ
    );
    expect(handshakeIndex(ranked)).toBeNull();
  });
});

describe("game day", () => {
  const game: CityEvent = {
    id: "mlb-1",
    name: "Cubs vs. Cards",
    category: "sports",
    venueName: "Wrigley Field",
    neighborhood: "Wrigleyville",
    lat: WRIGLEY.lat,
    lng: WRIGLEY.lng,
    start: "2026-06-10T19:05:00",
    end: "2026-06-10T22:00:00",
    recurring: null,
    priceFrom: null,
    free: false,
    url: null,
    blurb: "",
    tags: ["mlb"],
    verified: true,
  };

  it("flags bars within 1 km of a ballpark with a home game today", () => {
    const near = venue("nearpark", [deal([])], 41.949, -87.655); // ~150 m
    const far = venue("loop", [deal([])], HQ.lat, HQ.lng); // ~8 km
    const ids = gameDayVenueIds([near, far], [game], NOON);
    expect(ids.has("nearpark")).toBe(true);
    expect(ids.has("loop")).toBe(false);
  });

  it("no game today → no flags", () => {
    const other = { ...game, start: "2026-08-01T19:05:00", end: "2026-08-01T22:00:00" };
    expect(gameDayVenueIds([venue("nearpark", [], 41.949, -87.655)], [other], NOON).size).toBe(0);
  });
});

describe("pregame deals feed events into a plan", () => {
  it("surfaces cheapest pours reachable before an event", () => {
    const ranked = rankVenues(
      [venue("bar", [deal([{ label: "Beer", price: 4, category: "beer" }])], 41.948, -87.655)],
      NOON,
      HQ
    );
    const pg = pregameDeals(
      { ...({} as CityEvent), lat: WRIGLEY.lat, lng: WRIGLEY.lng },
      ranked,
      3
    );
    expect(pg.length).toBe(1);
    expect(pg[0].ranked.venue.id).toBe("bar");
  });
});
