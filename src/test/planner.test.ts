import { describe, it, expect } from "vitest";
import { planNight } from "../lib/engine/planner";
import { SeedSchema, type VenueWithDeals } from "../lib/types";
import { HQ } from "../lib/hq";
import seed from "../../data/seed.json";

function seedVenuesWithDeals(): VenueWithDeals[] {
  const parsed = SeedSchema.parse(seed);
  return parsed.venues.map((v) => ({
    ...v,
    deals: parsed.deals.filter((d) => d.venueId === v.id),
  }));
}

const at = (iso: string) => new Date(iso + "-05:00"); // CDT

describe("planNight — DoD: Wed 4:45 PM from HQ on seed data", () => {
  const venues = seedVenuesWithDeals();
  const wed445 = at("2026-06-10T16:45:00");

  it("produces a valid 3-stop run", () => {
    const plan = planNight(venues, {
      start: { lat: HQ.lat, lng: HQ.lng },
      startAt: wed445,
      stops: 3,
      maxWalkMin: 15,
      budget: null,
      vibes: [],
    });
    expect(plan).not.toBeNull();
    expect(plan!.stops.length).toBe(3);
  });

  it("every stop is EXTRACTED with a live deal, arrivals monotonic", () => {
    const plan = planNight(venues, {
      start: { lat: HQ.lat, lng: HQ.lng },
      startAt: wed445,
      stops: 3,
      maxWalkMin: 15,
      budget: null,
      vibes: [],
    })!;
    for (const s of plan.stops) {
      expect(s.venue.lifecycle).toBe("EXTRACTED");
      expect(s.stealScore).toBeGreaterThan(0);
    }
    for (let i = 1; i < plan.stops.length; i++) {
      expect(plan.stops[i].arriveAt.getTime()).toBeGreaterThan(
        plan.stops[i - 1].arriveAt.getTime()
      );
    }
  });

  it("respects the per-leg walk cap", () => {
    const plan = planNight(venues, {
      start: { lat: HQ.lat, lng: HQ.lng },
      startAt: wed445,
      stops: 3,
      maxWalkMin: 15,
      budget: null,
      vibes: [],
    })!;
    for (const s of plan.stops) expect(s.walkMin).toBeLessThanOrEqual(15);
  });

  it("honors a dives vibe filter (all stops are dive bars)", () => {
    const plan = planNight(venues, {
      start: { lat: HQ.lat, lng: HQ.lng },
      startAt: wed445,
      stops: 2,
      maxWalkMin: 20,
      budget: null,
      vibes: ["dives"],
    });
    if (plan) {
      for (const s of plan.stops) expect(s.venue.tags).toContain("dive");
    }
  });
});
