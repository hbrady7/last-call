import { describe, it, expect } from "vitest";
import type { Deal } from "../lib/types";
import { getDealStatus, bestStatus } from "../lib/engine/status";
import { scoreDeal } from "../lib/engine/score";
import { rankVenues } from "../lib/engine/rank";
import { chicagoNow } from "../lib/engine/time";

function deal(partial: Partial<Deal>): Deal {
  return {
    id: "d",
    venueId: "v",
    kind: "happy_hour",
    days: [0, 1, 2, 3, 4, 5, 6],
    startTime: "16:00",
    endTime: "17:00",
    items: [],
    finePrint: null,
    sourceUrl: null,
    confidence: 1,
    lastVerified: "2026-06-10T12:00:00.000Z",
    ...partial,
  };
}

// All instants are written in CDT (UTC-5), Chicago's summer offset.
const at = (iso: string) => new Date(iso + "-05:00");

describe("chicagoNow", () => {
  it("derives Chicago weekday + minute regardless of host tz", () => {
    const n = chicagoNow(at("2026-06-10T16:30:00"));
    expect(n.weekday).toBe(3); // Wednesday
    expect(n.minuteOfDay).toBe(16 * 60 + 30);
  });
});

describe("getDealStatus — happy hour", () => {
  const gilt = deal({ startTime: "16:00", endTime: "17:00" }); // daily

  it("is LIVE inside the window with minutes remaining", () => {
    const s = getDealStatus(gilt, at("2026-06-10T16:30:00"));
    expect(s.state).toBe("LIVE");
    expect(s.endsInMin).toBe(30);
  });

  it("is STARTS_SOON within 90 minutes of opening", () => {
    const s = getDealStatus(gilt, at("2026-06-10T15:30:00"));
    expect(s.state).toBe("STARTS_SOON");
    expect(s.startsInMin).toBe(30);
  });

  it("is LATER_TODAY when opening is more than 90 min out, same day", () => {
    const s = getDealStatus(gilt, at("2026-06-10T10:00:00"));
    expect(s.state).toBe("LATER_TODAY");
    expect(s.startsInMin).toBe(360);
  });

  it("is NOT_TODAY after the window with nothing left today", () => {
    const s = getDealStatus(gilt, at("2026-06-10T17:30:00"));
    expect(s.state).toBe("NOT_TODAY");
  });

  it("respects day-of-week restrictions", () => {
    const wedOnly = deal({ days: [3], startTime: "16:00", endTime: "18:00" });
    // Thursday → not today
    expect(getDealStatus(wedOnly, at("2026-06-11T16:30:00")).state).toBe(
      "NOT_TODAY"
    );
    // Wednesday → live
    expect(getDealStatus(wedOnly, at("2026-06-10T16:30:00")).state).toBe("LIVE");
  });
});

describe("getDealStatus — midnight crossing", () => {
  // Saturday 22:00 → 02:00 Sunday
  const lateNight = deal({ days: [6], startTime: "22:00", endTime: "02:00" });

  it("is LIVE before midnight on the start day", () => {
    const s = getDealStatus(lateNight, at("2026-06-13T23:00:00")); // Sat 11pm
    expect(s.state).toBe("LIVE");
    expect(s.endsInMin).toBe(180);
  });

  it("is LIVE after midnight via the Saturday→Sunday week wrap", () => {
    const s = getDealStatus(lateNight, at("2026-06-14T01:00:00")); // Sun 1am
    expect(s.state).toBe("LIVE");
    expect(s.endsInMin).toBe(60);
  });

  it("is not LIVE once the window has fully passed", () => {
    const s = getDealStatus(lateNight, at("2026-06-14T03:00:00")); // Sun 3am
    expect(s.state).toBe("NOT_TODAY");
  });
});

describe("getDealStatus — Sunday → Monday crossing", () => {
  const sunNight = deal({ days: [0], startTime: "20:00", endTime: "01:00" });

  it("is LIVE Monday 00:30 from Sunday's window", () => {
    const s = getDealStatus(sunNight, at("2026-06-15T00:30:00")); // Mon 12:30am
    expect(s.state).toBe("LIVE");
    expect(s.endsInMin).toBe(30);
  });
});

describe("getDealStatus — all_day", () => {
  const allDay = deal({
    kind: "all_day",
    days: [0, 1, 2, 3, 4, 5, 6],
    startTime: null,
    endTime: null,
  });

  it("is LIVE during the day (11:00–02:00)", () => {
    const s = getDealStatus(allDay, at("2026-06-10T13:00:00"));
    expect(s.state).toBe("LIVE");
    expect(s.endsInMin).toBe(13 * 60); // until 2am
  });

  it("is STARTS_SOON shortly before 11:00", () => {
    const s = getDealStatus(allDay, at("2026-06-10T10:30:00"));
    expect(s.state).toBe("STARTS_SOON");
    expect(s.startsInMin).toBe(30);
  });

  it("is LATER_TODAY in the dead 02:00–11:00 hours", () => {
    const s = getDealStatus(allDay, at("2026-06-10T08:00:00"));
    expect(s.state).toBe("LATER_TODAY");
    expect(s.startsInMin).toBe(180);
  });
});

describe("Steal Score", () => {
  it("scores Bar Cargo's $5-everything window at 61", () => {
    const barCargo = deal({
      startTime: "16:00",
      endTime: "18:00",
      items: [
        { label: "Well drinks", price: 5, category: "cocktail" },
        { label: "House wine", price: 5, category: "wine" },
        { label: "Domestic beer", price: 5, category: "beer" },
      ],
    });
    expect(scoreDeal(barCargo)).toBe(61);
  });

  it("scores Richard's $4 all-day beer at 60", () => {
    const richards = deal({
      kind: "all_day",
      startTime: null,
      endTime: null,
      items: [{ label: "Beer", price: 4, category: "beer" }],
    });
    expect(scoreDeal(richards)).toBe(60);
  });

  it("gives no discount/anchor credit when prices are null", () => {
    const reggies = deal({
      kind: "all_day",
      startTime: null,
      endTime: null,
      items: [{ label: "Cheap drinks", price: null, category: "beer" }],
    });
    // window 15 + breadth (1/8*20=2.5) only → 18 (rounded from 17.5)
    expect(scoreDeal(reggies)).toBe(18);
  });
});

describe("bestStatus", () => {
  it("prefers a LIVE deal over a not-today one", () => {
    const live = deal({ id: "a", startTime: "16:00", endTime: "18:00" });
    const notToday = deal({ id: "b", days: [3], startTime: "16:00", endTime: "18:00" });
    const best = bestStatus([notToday, live], at("2026-06-11T16:30:00")); // Thu
    expect(best?.deal.id).toBe("a");
    expect(best?.status.state).toBe("LIVE");
  });
});

describe("rankVenues", () => {
  it("ranks LIVE + cheap + close above a far, not-today venue", () => {
    const now = at("2026-06-10T16:30:00");
    const user = { lat: 41.8895, lng: -87.6325 }; // River North
    const liveVenue = {
      id: "live",
      slug: "live",
      name: "Live Spot",
      address: null,
      neighborhood: null,
      lat: 41.8897,
      lng: -87.628,
      website: null,
      dealSourceUrl: null,
      tags: [],
      cashOnly: false,
      deals: [
        deal({
          venueId: "live",
          startTime: "16:00",
          endTime: "18:00",
          items: [{ label: "Beer", price: 4, category: "beer" }],
        }),
      ],
    };
    const closedVenue = {
      ...liveVenue,
      id: "closed",
      slug: "closed",
      name: "Closed Spot",
      lat: 41.97,
      lng: -87.66,
      deals: [
        deal({
          venueId: "closed",
          days: [3] /* Wed only, but now is Wed... use Sat */,
          startTime: "16:00",
          endTime: "18:00",
          items: [{ label: "Beer", price: 4, category: "beer" }],
        }),
      ],
    };
    // make closedVenue not-today: set its deal to Saturday only
    closedVenue.deals[0].days = [6];
    const ranked = rankVenues([closedVenue, liveVenue], now, user);
    expect(ranked[0].venue.id).toBe("live");
    expect(ranked[0].status.state).toBe("LIVE");
  });
});
