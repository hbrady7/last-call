/**
 * Push the verified seed.json into a Neon database (idempotent upsert).
 * Usage: DATABASE_URL=... pnpm db:seed
 * No DATABASE_URL → exits loudly without touching anything.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { venues, deals } from "../drizzle/schema";
import { SeedSchema } from "../src/lib/types";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) {
    console.error(
      "✗ No DATABASE_URL set. Nothing to seed — the app already works on seed.json via StaticRepo."
    );
    process.exit(1);
  }

  const seedPath = fileURLToPath(new URL("../data/seed.json", import.meta.url));
  const seed = SeedSchema.parse(JSON.parse(readFileSync(seedPath, "utf-8")));
  const db = drizzle(neon(url));

  console.log(`Seeding ${seed.venues.length} venues, ${seed.deals.length} deals…`);

  for (const v of seed.venues) {
    await db
      .insert(venues)
      .values(v)
      .onConflictDoUpdate({
        target: venues.id,
        set: {
          name: v.name,
          address: v.address,
          neighborhood: v.neighborhood,
          lat: v.lat,
          lng: v.lng,
          website: v.website,
          dealSourceUrl: v.dealSourceUrl,
          tags: v.tags,
          cashOnly: v.cashOnly,
        },
      });
  }

  for (const d of seed.deals) {
    await db
      .insert(deals)
      .values({ ...d, lastVerified: new Date(d.lastVerified) })
      .onConflictDoUpdate({
        target: deals.id,
        set: {
          kind: d.kind,
          days: d.days,
          startTime: d.startTime,
          endTime: d.endTime,
          items: d.items,
          finePrint: d.finePrint,
          sourceUrl: d.sourceUrl,
          confidence: d.confidence,
          lastVerified: new Date(d.lastVerified),
        },
      });
  }

  console.log(`✓ Seed complete. ${seed.venues.length} venues upserted.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("✗ Seed failed:", e);
  process.exit(1);
});
