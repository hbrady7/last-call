import { z } from "zod";
import {
  SeedSchema,
  VenueSchema,
  type Deal,
  type Venue,
  type VenueWithDeals,
} from "./types";
import seedJson from "../../data/seed.json";
import censusJson from "../../data/census.json";
import { haversineMeters } from "./engine/distance";

const CensusSchema = z.object({
  generatedAt: z.string().nullable().optional(),
  venues: z.array(VenueSchema),
});

/** Normalize a venue name for dedupe: strip LLC/INC, punctuation, case. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|ltd|co|corp|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Merge census venues onto the verified seed. Seed wins on existence; a census
 * venue is dropped when it matches a seed venue by normalized name or sits
 * within 60 m of one (same-bar dedupe).
 */
function mergeCensus(seed: Venue[], census: Venue[]): Venue[] {
  const seedNames = new Set(seed.map((v) => normalizeName(v.name)));
  const merged = [...seed];
  for (const c of census) {
    if (seedNames.has(normalizeName(c.name))) continue;
    const dup = seed.some(
      (s) =>
        s.lat != null &&
        s.lng != null &&
        c.lat != null &&
        c.lng != null &&
        haversineMeters(s.lat, s.lng, c.lat, c.lng) < 60 &&
        normalizeName(s.name).slice(0, 4) === normalizeName(c.name).slice(0, 4)
    );
    if (!dup) merged.push(c);
  }
  return merged;
}

export interface DealsRepo {
  /** Every venue with its deals attached. Callers filter for display. */
  getVenuesWithDeals(): Promise<VenueWithDeals[]>;
  getVenueBySlug(slug: string): Promise<VenueWithDeals | null>;
  /** Venues that have a dealSourceUrl, stalest-deal-first, for the extractor. */
  getStalestVenues(limit: number): Promise<Venue[]>;
  /** UNSCOUTED venues (oldest-first by id), for the scout step. */
  getUnscoutedVenues(limit: number): Promise<Venue[]>;
  /** Atomically replace a venue's happy_hour deals (pipeline write). */
  replaceHappyHourDeals(venueId: string, deals: Deal[]): Promise<void>;
  logScrape(entry: {
    venueId: string;
    step?: "scout" | "extract";
    status: string;
    note?: string;
  }): Promise<void>;
  /** Recent scrape_log entries, newest first (empty under StaticRepo). */
  getScrapeLog(limit: number): Promise<ScrapeLogEntry[]>;
  /** Persist scout results: website/dealSourceUrl + lifecycle advance. */
  setScoutResult(
    venueId: string,
    patch: {
      website?: string | null;
      dealSourceUrl?: string | null;
      lifecycle: Venue["lifecycle"];
    }
  ): Promise<void>;
}

export interface ScrapeLogEntry {
  venueId: string;
  step: string;
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
    class: v.class,
    lifecycle: v.lifecycle,
    website: v.website,
    dealSourceUrl: v.dealSourceUrl,
    tags: v.tags,
    cashOnly: v.cashOnly,
    distanceFromHqM: v.distanceFromHqM,
  };
  return bare;
}

// ─────────────────────────── StaticRepo (seed.json) ───────────────────────────
class StaticRepo implements DealsRepo {
  private venues: Venue[]; // merged (seed + census) — what reads return
  private seedVenues: Venue[]; // original seed only — what persists to seed.json
  private deals: Deal[];

  constructor() {
    const parsed = SeedSchema.parse(seedJson);
    const census = CensusSchema.parse(censusJson);
    this.seedVenues = parsed.venues;
    this.venues = mergeCensus(parsed.venues, census.venues);
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

  async getUnscoutedVenues(limit: number): Promise<Venue[]> {
    return this.venues
      .filter((v) => v.lifecycle === "UNSCOUTED")
      .slice(0, limit);
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
        JSON.stringify({ venues: this.seedVenues, deals: this.deals }, null, 2) +
          "\n"
      );
    } catch (e) {
      console.warn(
        "[StaticRepo] could not persist deals (read-only fs?). Change kept in-memory only.",
        e
      );
    }
  }

  async setScoutResult(
    venueId: string,
    patch: {
      website?: string | null;
      dealSourceUrl?: string | null;
      lifecycle: Venue["lifecycle"];
    }
  ): Promise<void> {
    const apply = (v: Venue) => {
      if (v.id !== venueId) return v;
      return {
        ...v,
        website: patch.website ?? v.website,
        dealSourceUrl: patch.dealSourceUrl ?? v.dealSourceUrl,
        lifecycle: patch.lifecycle,
      };
    };
    this.venues = this.venues.map(apply);
    this.seedVenues = this.seedVenues.map(apply);
  }

  async logScrape(entry: {
    venueId: string;
    step?: "scout" | "extract";
    status: string;
    note?: string;
  }): Promise<void> {
    console.log(
      `[scrape_log:${entry.step ?? "extract"}] ${entry.venueId} → ${entry.status}${entry.note ? ` · ${entry.note}` : ""}`
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

  async getUnscoutedVenues(limit: number): Promise<Venue[]> {
    const db = await this.dbPromise;
    const schema = await this.schemaPromise;
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(schema.venues)
      .where(eq(schema.venues.lifecycle, "UNSCOUTED"))
      .limit(limit);
    return rows as Venue[];
  }

  async setScoutResult(
    venueId: string,
    patch: {
      website?: string | null;
      dealSourceUrl?: string | null;
      lifecycle: Venue["lifecycle"];
    }
  ): Promise<void> {
    const db = await this.dbPromise;
    const schema = await this.schemaPromise;
    const { eq } = await import("drizzle-orm");
    const set: Record<string, unknown> = { lifecycle: patch.lifecycle };
    if (patch.website !== undefined) set.website = patch.website;
    if (patch.dealSourceUrl !== undefined) set.dealSourceUrl = patch.dealSourceUrl;
    await db.update(schema.venues).set(set).where(eq(schema.venues.id, venueId));
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
    step?: "scout" | "extract";
    status: string;
    note?: string;
  }): Promise<void> {
    const db = await this.dbPromise;
    const schema = await this.schemaPromise;
    await db.insert(schema.scrapeLog).values({
      venueId: entry.venueId,
      step: entry.step ?? "extract",
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
      step: (r.step as string) ?? "extract",
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
