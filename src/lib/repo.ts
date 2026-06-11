import {
  SeedSchema,
  type Deal,
  type Venue,
  type VenueWithDeals,
} from "./types";
import seedJson from "../../data/seed.json";

export interface DealsRepo {
  /** Every venue with its deals attached. Callers filter for display. */
  getVenuesWithDeals(): Promise<VenueWithDeals[]>;
  getVenueBySlug(slug: string): Promise<VenueWithDeals | null>;
  /** Venues that have a dealSourceUrl, stalest-deal-first, for the scraper. */
  getStalestVenues(limit: number): Promise<Venue[]>;
  /** Atomically replace a venue's happy_hour deals (pipeline write). */
  replaceHappyHourDeals(venueId: string, deals: Deal[]): Promise<void>;
  logScrape(entry: {
    venueId: string;
    status: string;
    note?: string;
  }): Promise<void>;
  /** Recent scrape_log entries, newest first (empty under StaticRepo). */
  getScrapeLog(limit: number): Promise<ScrapeLogEntry[]>;
}

export interface ScrapeLogEntry {
  venueId: string;
  ranAt: string;
  status: string;
  note: string | null;
}

function attachDeals(venues: Venue[], deals: Deal[]): VenueWithDeals[] {
  return venues.map((v) => ({
    ...v,
    deals: deals.filter((d) => d.venueId === v.id),
  }));
}

/** Stalest = oldest lastVerified across a venue's deals (no deals = oldest). */
function stalest(a: VenueWithDeals): number {
  if (a.deals.length === 0) return 0;
  return Math.min(...a.deals.map((d) => new Date(d.lastVerified).getTime()));
}

/** Drop the attached deals, leaving a bare Venue. */
function stripDeals(v: VenueWithDeals): Venue {
  const bare: Venue = {
    id: v.id,
    slug: v.slug,
    name: v.name,
    address: v.address,
    neighborhood: v.neighborhood,
    lat: v.lat,
    lng: v.lng,
    website: v.website,
    dealSourceUrl: v.dealSourceUrl,
    tags: v.tags,
    cashOnly: v.cashOnly,
  };
  return bare;
}

// ─────────────────────────── StaticRepo (seed.json) ───────────────────────────
class StaticRepo implements DealsRepo {
  private venues: Venue[];
  private deals: Deal[];

  constructor() {
    const parsed = SeedSchema.parse(seedJson);
    this.venues = parsed.venues;
    this.deals = parsed.deals;
  }

  async getVenuesWithDeals(): Promise<VenueWithDeals[]> {
    return attachDeals(this.venues, this.deals);
  }

  async getVenueBySlug(slug: string): Promise<VenueWithDeals | null> {
    const v = this.venues.find((x) => x.slug === slug);
    if (!v) return null;
    return { ...v, deals: this.deals.filter((d) => d.venueId === v.id) };
  }

  async getStalestVenues(limit: number): Promise<Venue[]> {
    const withDeals = attachDeals(
      this.venues.filter((v) => v.dealSourceUrl),
      this.deals
    );
    return withDeals
      .sort((a, b) => stalest(a) - stalest(b))
      .slice(0, limit)
      .map(stripDeals);
  }

  async replaceHappyHourDeals(venueId: string, deals: Deal[]): Promise<void> {
    // Persist to seed.json when the filesystem is writable (local `pnpm scrape`).
    // In a read-only serverless runtime this throws and we degrade loudly.
    this.deals = [
      ...this.deals.filter(
        (d) => !(d.venueId === venueId && d.kind === "happy_hour")
      ),
      ...deals,
    ];
    try {
      const { writeFile } = await import("node:fs/promises");
      const { fileURLToPath } = await import("node:url");
      const path = fileURLToPath(
        new URL("../../data/seed.json", import.meta.url)
      );
      await writeFile(
        path,
        JSON.stringify({ venues: this.venues, deals: this.deals }, null, 2) +
          "\n"
      );
    } catch (e) {
      console.warn(
        "[StaticRepo] could not persist deals (read-only fs?). Change kept in-memory only.",
        e
      );
    }
  }

  async logScrape(entry: {
    venueId: string;
    status: string;
    note?: string;
  }): Promise<void> {
    console.log(
      `[scrape_log] ${entry.venueId} → ${entry.status}${entry.note ? ` · ${entry.note}` : ""}`
    );
  }

  async getScrapeLog(): Promise<ScrapeLogEntry[]> {
    return []; // StaticRepo logs to the console only.
  }
}

// ─────────────────────────── DrizzleRepo (Neon) ───────────────────────────
class DrizzleRepo implements DealsRepo {
  // Loaded lazily so the Neon/Drizzle deps never enter the StaticRepo path.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private dbPromise: Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private schemaPromise: Promise<any>;

  constructor(private url: string) {
    this.schemaPromise = import("../../drizzle/schema");
    this.dbPromise = (async () => {
      const { drizzle } = await import("drizzle-orm/neon-http");
      const { neon } = await import("@neondatabase/serverless");
      return drizzle(neon(this.url));
    })();
  }

  private toDeal(row: Record<string, unknown>): Deal {
    return {
      id: row.id as string,
      venueId: row.venueId as string,
      kind: row.kind as Deal["kind"],
      days: (row.days as number[]) ?? [],
      startTime: (row.startTime as string | null) ?? null,
      endTime: (row.endTime as string | null) ?? null,
      items: (row.items as Deal["items"]) ?? [],
      finePrint: (row.finePrint as string | null) ?? null,
      sourceUrl: (row.sourceUrl as string | null) ?? null,
      confidence: (row.confidence as number) ?? 1,
      lastVerified: new Date(row.lastVerified as string).toISOString(),
    };
  }

  async getVenuesWithDeals(): Promise<VenueWithDeals[]> {
    const db = await this.dbPromise;
    const schema = await this.schemaPromise;
    const [venues, deals] = await Promise.all([
      db.select().from(schema.venues),
      db.select().from(schema.deals),
    ]);
    const typedDeals = deals.map((d: Record<string, unknown>) => this.toDeal(d));
    return (venues as Venue[]).map((v) => ({
      ...v,
      deals: typedDeals.filter((d: Deal) => d.venueId === v.id),
    }));
  }

  async getVenueBySlug(slug: string): Promise<VenueWithDeals | null> {
    const all = await this.getVenuesWithDeals();
    return all.find((v) => v.slug === slug) ?? null;
  }

  async getStalestVenues(limit: number): Promise<Venue[]> {
    const all = await this.getVenuesWithDeals();
    return all
      .filter((v) => v.dealSourceUrl)
      .sort((a, b) => stalest(a) - stalest(b))
      .slice(0, limit)
      .map(stripDeals);
  }

  async replaceHappyHourDeals(venueId: string, deals: Deal[]): Promise<void> {
    const db = await this.dbPromise;
    const schema = await this.schemaPromise;
    const { eq, and } = await import("drizzle-orm");
    await db
      .delete(schema.deals)
      .where(
        and(eq(schema.deals.venueId, venueId), eq(schema.deals.kind, "happy_hour"))
      );
    if (deals.length > 0) {
      await db.insert(schema.deals).values(
        deals.map((d) => ({
          id: d.id,
          venueId: d.venueId,
          kind: d.kind,
          days: d.days,
          startTime: d.startTime,
          endTime: d.endTime,
          items: d.items,
          finePrint: d.finePrint,
          sourceUrl: d.sourceUrl,
          confidence: d.confidence,
          lastVerified: new Date(d.lastVerified),
        }))
      );
    }
  }

  async logScrape(entry: {
    venueId: string;
    status: string;
    note?: string;
  }): Promise<void> {
    const db = await this.dbPromise;
    const schema = await this.schemaPromise;
    await db.insert(schema.scrapeLog).values({
      venueId: entry.venueId,
      status: entry.status,
      note: entry.note ?? null,
    });
  }

  async getScrapeLog(limit: number): Promise<ScrapeLogEntry[]> {
    const db = await this.dbPromise;
    const schema = await this.schemaPromise;
    const { desc } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(schema.scrapeLog)
      .orderBy(desc(schema.scrapeLog.ranAt))
      .limit(limit);
    return (rows as Record<string, unknown>[]).map((r) => ({
      venueId: r.venueId as string,
      ranAt: new Date(r.ranAt as string).toISOString(),
      status: r.status as string,
      note: (r.note as string | null) ?? null,
    }));
  }
}

let cached: DealsRepo | null = null;

/** Pick the repo at boot: Neon if DATABASE_URL is set, else the bundled seed. */
export function getRepo(): DealsRepo {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  cached = url && url.trim() ? new DrizzleRepo(url) : new StaticRepo();
  return cached;
}

export const usingDatabase = () =>
  Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
