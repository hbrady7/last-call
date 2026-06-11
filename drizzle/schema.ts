import {
  pgTable,
  text,
  boolean,
  integer,
  doublePrecision,
  real,
  jsonb,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";
import type { DealItem } from "../src/lib/types";

export const venues = pgTable("venues", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  address: text("address"),
  neighborhood: text("neighborhood"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  website: text("website"),
  dealSourceUrl: text("deal_source_url"),
  tags: text("tags").array().notNull().default([]),
  cashOnly: boolean("cash_only").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deals = pgTable("deals", {
  id: text("id").primaryKey(),
  venueId: text("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 'happy_hour' | 'all_day'
  days: integer("days").array().notNull().default([]),
  startTime: text("start_time"), // 'HH:mm' | null
  endTime: text("end_time"),
  items: jsonb("items").$type<DealItem[]>().notNull().default([]),
  finePrint: text("fine_print"),
  sourceUrl: text("source_url"),
  confidence: real("confidence").notNull().default(1),
  lastVerified: timestamp("last_verified", { withTimezone: true }).notNull().defaultNow(),
});

export const scrapeLog = pgTable("scrape_log", {
  id: serial("id").primaryKey(),
  venueId: text("venue_id").notNull(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull(), // ok | no_deal_found | fetch_error | low_confidence
  note: text("note"),
});
