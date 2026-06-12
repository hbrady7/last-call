# LAST CALL — Chicago Happy-Hour Radar

A neon GPS radar and night-planner for every drink deal around the office at
**330 N Wabash (AMA Plaza)**. Open it and the **RIGHT NOW** strip leads with the
top-3 live picks — price, walk, ends-in, one-tap directions — *before any
control*. Behind it a Neon-Dive map shows every licensed bar within **2 miles**,
clusters glowing red where deals are live. Plan a whole night with a beam-search
itinerary (and let the app **roast it**), follow a giant glowing arrow to the
nearest live deal (**BEELINE MODE**), spin the **Wheel of Poor Decisions**, and
watch the city light up week over week as an AI pipeline drinks through venue
websites. The three-second test is the bar: open it → know where to go.

**The app fully works with zero environment variables** — it ships with the
entire ~1,000-venue census, the verified seed, and 116 Chicago events (94 of
them live-sourced) committed to the repo.

---

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm build   # the green-on-every-commit trio
pnpm test         # engine + planner + quality + soul Vitest suites (31 tests)
pnpm qa           # data-quality report (price bands, dupes, schedule, stale)
pnpm events:mlb   # refresh verified Cubs/Sox home games from the free MLB API
```

## Environment (all optional)

Copy `.env.example` → `.env.local`. Every var is optional; the app degrades
gracefully without each.

| Var | Enables | Without it |
|---|---|---|
| `DATABASE_URL` | Neon Postgres (`DrizzleRepo`) | `StaticRepo` serves `data/census.json` + `data/seed.json` |
| `ANTHROPIC_API_KEY` | The scout + extract AI pipeline | Scout/extract no-op **loudly**; existing data kept |
| `CRON_SECRET` | `/api/cron/refresh` + `/admin` | Cron returns 503 with setup help; `/admin` disabled |

### Neon setup

1. Create a Neon project, copy the connection string into `DATABASE_URL`.
2. `pnpm db:push` — creates the `venues`, `deals`, `scrape_log` tables.
3. `pnpm db:seed` — upserts the verified seed (idempotent).
4. (optional) load the census into the DB by seeding from `data/census.json`
   the same way, or just keep running in static mode — both serve every venue.

### Vercel cron setup

`vercel.json` already declares the schedule:

```json
{ "crons": [{ "path": "/api/cron/refresh", "schedule": "0 14 * * 1,4" }] }
```

That's **Mon + Thu 09:00 America/Chicago** (summer). Add `CRON_SECRET` (and
`DATABASE_URL` + `ANTHROPIC_API_KEY`) in the Vercel project's env settings; Vercel
sends the `Authorization: Bearer <CRON_SECRET>` header automatically. Each tick
**scouts 15** UNSCOUTED venues then **extracts 15** stalest ones.

---

## The Census — every bar, day one

`pnpm census` merges two free, keyless public sources and writes
`data/census.json` (committed):

1. **Chicago Business Licenses** (Socrata `uupf-x98q`) —
   `within_circle(location, 41.8886592, -87.627596, 3219)` filtered to
   `Tavern`, `Late Hour`, `Consumption on Premises - Incidental Activity`.
   Tavern/Late Hour → `class: 'bar'`; Incidental → `class: 'restaurant-bar'`.
2. **OpenStreetMap Overpass** — bars/pubs/nightclubs in the same radius,
   harvested for `website`.

Merged & deduped by normalized name + <60 m proximity (license wins on
existence, OSM wins on website). Re-runnable and idempotent. Current run:
**~1,020 venues**.

### Venue lifecycle

`UNSCOUTED` → `SCOUTED` → `EXTRACTED` / `NO_DEAL_FOUND`. The map renders all four
honestly: EXTRACTED glows with its score (red pulse if LIVE), SCOUTED an amber
dot, UNSCOUTED a faint ember, NO_DEAL_FOUND a dim ring. The radar lights up as
the pipeline works — that's the product.

---

## Pipeline ops

```bash
pnpm scout                 # web_search → official site + specials URL, 25 oldest UNSCOUTED
pnpm scrape                # extract deals from dealSourceUrl, 25 stalest
pnpm scrape --venue gilt-bar   # one venue
```

- **Scout** — `claude-haiku-4-5` + `web_search` server tool, temp 0; rejects
  aggregators (Yelp/Google/FB/OpenTable/…); advances to SCOUTED.
- **Extract** — fetch (10 s timeout, bot UA, ≤1 req/sec) → cheerio strip (15k
  cap) → forced tool-use JSON, Zod-validated. **Only explicitly-printed prices**;
  never infers; nothing posted → `found:false`; ≤20 items. confidence ≥ 0.6 →
  atomically replaces happy_hour deals; else logs and keeps old data.
- `/admin?key=CRON_SECRET` — coverage dashboard: scouted/extracted %, deal
  counts, the step-tagged `scrape_log`, per-venue refresh, "run next batch".

**Never fabricated:** deals exist only as the verified seed or pipeline
extractions with a source URL + confidence. A bar with unknown deals shows as
unknown — that honesty is a feature.

---

## How the engine ranks

All schedule math is in **America/Chicago**, computed in "minute of the week"
space so midnight-crossing and Sun→Mon windows fall out of modular arithmetic.

**Status** — `LIVE` (+endsInMin) · `STARTS_SOON` (<90 min) · `LATER_TODAY` ·
`NOT_TODAY`. all_day deals are LIVE 11:00–02:00 daily.

**Steal Score (0–100)** vs baselines `{beer:8, wine:14, cocktail:16, shot:9,
food:15}`:

```
45 · avg(max(0, 1 − price/baseline))      // discount depth (priced items only)
20 · min(items, 8) / 8                     // breadth
15 · min(hours, 4) / 4                     // window  (all_day = full 15)
20 · anchor:  any drink ≤ $5 → 20, ≤ $6 → 12
```

**Rank** = `score × statusWeight(LIVE 1.0 / SOON .8 / LATER .5 / NOT .2) − 1.5 ×
walkMinutes`, where walk = haversine / 80 m·min⁻¹ from the active anchor (Office
or GPS).

## The Planner (`/plan`)

Beam search (width 5) over EXTRACTED venues. Each leg's candidates are reachable
within the per-leg walk cap and live on arrival with ≥20 min left; leg score =
`stealScore × windowFit − walk × 1.5`. all_day dives fill late legs. Output: an
itinerary with arrive/leave times, the move to order, running damage vs budget,
plus shuffle / share / save. Unit-tested: **Wed 4:45 PM from HQ on seed data
alone yields a valid 3-stop run.**

**Perfect-match search** — a keyless phrase parser ("martinis under $8", "patio
now", "dive open late") maps to a category/price/time/tag filter over list + map.

---

## Data quality — `pnpm qa`

`scripts/qa.ts` is the sieve over the deal corpus: price sanity bands per
category (beer $1–12, wine $3–20, cocktail $4–25, shot $1–15, food $1–30),
duplicate-deal merge (same kind + overlapping window), schedule-nonsense flags
(end ≤ start, 0-day arrays, happy_hour > 8h), and a stale sweep (>45 days).
Reports by default; `pnpm qa --fix` writes `needsReview` flags + merges to
`data/seed.json`. Flagged intel is **excluded from the cheapest-drink key and
the headline status** and rendered with an "unverified" tag — never shown as
fact. A **"report bad intel"** button on every deal posts to `/api/report`,
which logs a `reported` row to `scrape_log` (surfaces in `/admin`, queues a
re-extraction).

## Chicago events — with provenance

`data/events.json` ships two kinds of events, both honest about their source:

- **Verified** — Cubs (team 112, Wrigley) + White Sox (145, Rate Field) **home
  games pulled live from the free, keyless [MLB StatsAPI]**
  (`statsapi.mlb.com`) via `pnpm events:mlb`. Each row carries `source`,
  `fetchedAt`, `verified: true`. 94 games this run.
- **Curated** — hand-verified music/festival/comedy venues + coordinates with
  real homepage URLs; dates are representative of the season and **labeled
  "Curated"** in the UI with their source. Never dressed as live data.

Events feed the planner: every event opens a **pre-game** sheet (cheapest pours
within an easy walk) and a **Game Day** flag lights bars within 1 km of a
ballpark hosting a home game today (⚾ pennant + row tag).

## The Awesome Layer

1. **RIGHT NOW strip** — top-3 live picks (price, walk, ends-in, one-tap
   directions) + a Plan card, rendered before any control. The header's live
   count cycles the camera through live venues.
2. **BEELINE MODE** — full-screen drunk-proof compass; a giant glowing arrow
   (device orientation + geolocation bearing) points at the nearest live deal.
3. **The Handshake Index** — Chicago's Dow Jones: the cheapest live Old Style +
   Malört combo within the ring, shown proud atop the sheet.
4. **Wheel of Poor Decisions** — neon slot reel (shake-to-spin) lands on an open
   dive ≤20-min walk + a dare from the voice system.
5. **Roast My Plan** — the planner's itinerary sent to Haiku (key-optional;
   canned roasts without a key) for a two-sentence roast of *your choices*.
6. **Tonight's Play** · **Damage calculator** · **Time scrubber** · **Radar
   sweep** · cinematic **first-open onboarding** (3s, skippable, never again).

## The voice (`lib/voice.ts`)

Deterministic, **day-seeded** copy so the app reads consistently all Wednesday
and changes its tune by Thursday (no `Math.random` — testable). Funny,
Chicago-coded, punches at prices / Malört / your own choices — **never at
people**, no slurs, nothing cruel; destructive flows stay straight-faced.
Powers empty/error/loading states, lore drops, roasts, and dares. `VOICE_RULES`
is embedded verbatim in the Roast My Plan prompt.

## Share cards (`/share`)

Meme-grade OG images (1200×630) in three templates — **Summon**
("WE RIDE AT 5 · GILT BAR · $6 MARTINIS · DON'T BE LATE"), **Receipt**,
**Challenge** — rendered from caller params via `next/og`. The planner's Share
fires the native sheet with a Summon card URL that unfurls big in any group chat.

---

## Design — "Neon Dive"

A dive bar at night, not a dark-mode dashboard. Brown-black `--ink #16100B`,
beer-sign `--neon-amber #FFB52E`, one true `--live-red #FF4530` for LIVE only,
`--brass` hardware, `--cream` text. Archivo Black display, IBM Plex Mono tabular
numerals on every timer, Archivo body. LIVE elements are lit neon tubes —
double text-shadow glow + a slow 4% flicker, all killed under reduced-motion.

## Stack

Next.js 15 App Router · TypeScript strict · Tailwind v4 (`@theme`) · Framer
Motion · Lucide · Zustand (persist) · Leaflet + react-leaflet on keyless CARTO
Dark Matter tiles · supercluster · Drizzle + Neon · `@anthropic-ai/sdk` · Zod ·
date-fns-tz · Vitest · hand-rolled PWA (manifest + service worker) · Vercel.

## Adding a venue by hand

Append to `data/seed.json` `venues` (with `class`, `lifecycle: "EXTRACTED"`,
`distanceFromHqM`) and `deals`. Run `pnpm test` — the engine validates the seed
via Zod on boot. Seed always wins over the census on merge.

---

See [`DECISIONS.md`](./DECISIONS.md) for the full build log — every judgment call
made under design-lead authority.
