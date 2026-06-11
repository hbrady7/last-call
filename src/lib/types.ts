import { z } from "zod";

/** Drink/food category, used for Steal Score baselines. */
export const DealCategory = z.enum(["beer", "wine", "cocktail", "shot", "food"]);
export type DealCategory = z.infer<typeof DealCategory>;

export const DealKind = z.enum(["happy_hour", "all_day"]);
export type DealKind = z.infer<typeof DealKind>;

const TimeStr = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm in 24h")
  .nullable();

export const DealItemSchema = z.object({
  label: z.string().min(1),
  /** null = price not printed / verified — never fabricate a number. */
  price: z.number().positive().nullable(),
  category: DealCategory,
});
export type DealItem = z.infer<typeof DealItemSchema>;

export const DealSchema = z.object({
  id: z.string(),
  venueId: z.string(),
  kind: DealKind,
  /** 0 = Sunday … 6 = Saturday. */
  days: z.array(z.number().int().min(0).max(6)),
  startTime: TimeStr,
  endTime: TimeStr,
  items: z.array(DealItemSchema),
  finePrint: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  /** ISO timestamp. */
  lastVerified: z.string(),
});
export type Deal = z.infer<typeof DealSchema>;

export const VenueClass = z.enum(["bar", "restaurant-bar"]);
export type VenueClass = z.infer<typeof VenueClass>;

export const Lifecycle = z.enum([
  "UNSCOUTED", // census only — no site/HH URL yet
  "SCOUTED", // official site / HH URL found
  "EXTRACTED", // deals found, confidence-stamped
  "NO_DEAL_FOUND", // checked, nothing posted
]);
export type Lifecycle = z.infer<typeof Lifecycle>;

export const VenueSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  neighborhood: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  class: VenueClass.default("bar"),
  lifecycle: Lifecycle.default("UNSCOUTED"),
  website: z.string().nullable(),
  dealSourceUrl: z.string().nullable(),
  tags: z.array(z.string()),
  cashOnly: z.boolean(),
  /** Precomputed haversine meters from HQ (null if coords unknown). */
  distanceFromHqM: z.number().nullable().default(null),
});
export type Venue = z.infer<typeof VenueSchema>;

export type VenueWithDeals = Venue & { deals: Deal[] };

export const SeedSchema = z.object({
  venues: z.array(VenueSchema),
  deals: z.array(DealSchema),
});
export type Seed = z.infer<typeof SeedSchema>;

/** Shape returned by the Anthropic extraction tool-call (Phase 5). */
export const ExtractionSchema = z.object({
  found: z.boolean(),
  deals: z.array(
    z.object({
      kind: DealKind,
      days: z.array(z.number().int().min(0).max(6)),
      startTime: TimeStr,
      endTime: TimeStr,
      items: z.array(DealItemSchema).max(20),
      finePrint: z.string().nullable(),
    })
  ),
  confidence: z.number().min(0).max(1),
});
export type Extraction = z.infer<typeof ExtractionSchema>;
