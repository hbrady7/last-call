# DECISIONS — the story of every judgment call

Append-only log of choices made under design-lead authority. Newest at the bottom of each phase.

## Phase 0 — Scaffold

- **Manual scaffold over `create-next-app`.** The CLI is interactive and slow; I
  hand-wrote `package.json`, `tsconfig`, Tailwind v4 PostCSS, and ESLint flat
  config for full control and a deterministic build.
- **shadcn primitives hand-rolled, not CLI-installed.** Running the shadcn CLI
  mid-build risks interactive prompts and a registry round-trip. I implement the
  handful of primitives I need (Button, Sheet, Badge, Chip) directly in the Neon
  Dive language. `components.json` is present so the CLI still works later.
- **PWA icons are SVG, not PNG.** Keyless, zero-binary, and Chrome accepts SVG
  for installability. Avoids shelling out to an image toolchain mid-build. PNG
  fallbacks can be added in Phase 7 if Lighthouse PWA flags it.
- **Service worker is network-first for `/api/`, stale-while-revalidate for the
  shell.** Deal prices and countdowns must never be served stale; the app shell
  can be.
- **Infra handoff (logged, not blocking):** `gh` CLI is absent and no GitHub
  token is available. The SSH remote `git@github.com:hbrady7/last-call.git`
  already existed, so the first push succeeded — pushes work. The Vercel CLI is
  not authenticated in this environment, so the owner links the repo to Vercel
  once to enable auto-deploy on push. Per SHIP RULES, missing credentials
  degrade gracefully and never block the build.

## Phase 1 — Data layer

- **`id === slug`** for venues, and deal ids are `<slug>-<kind/suffix>`. Human
  readable, stable across reseeds, and lets upserts be idempotent.
- **`price: null` is a first-class value, never a fake number.** Reggies ("cheap
  drinks, prices vary") and Beatrix's Monday half-price wine bottles carry
  `null` prices. Steal Score treats null as "no discount data," so honesty costs
  them score rather than inventing a price. This directly serves SHIP RULE #5.
- **Sushi-san is two `happy_hour` rows** (Mon–Thu 16–18, Fri–Sun 15–17) because
  the schema is one window per deal. The status machine picks whichever applies
  today.
- **The 6 pipeline stubs have `lat/lng = null` and are hidden** by the
  `/api/venues` coords filter until geocoded — so zero-env serves exactly 12
  mappable, deal-bearing venues, matching the Phase 1 DoD.
- **`StaticRepo.replaceHappyHourDeals` writes back to seed.json** when the fs is
  writable (local `pnpm scrape`) and degrades loudly on read-only serverless.

## Phase 2 — Map + sheet

- **Bottom sheet = a 92dvh panel translated down**, not an animated-height box.
  Three snap offsets (peek 18 / mid 55 / full 92) are positions of one panel;
  the grab handle drives a `y` motion value via pointer events and snaps to the
  nearest offset on release (with a velocity proxy). The body scrolls
  independently because only the handle captures the pointer — no scroll-vs-drag
  fight.
- **Markers are `L.divIcon` score badges with CSS classes**, not Tailwind
  utility strings — Tailwind v4 can't reliably scan classes inside a template
  literal handed to Leaflet, so marker styles live in `globals.css`
  (`.lc-pin--live/soon/dim`).
- **Selection is global (Zustand), shared by map + list.** Tapping a marker or a
  row sets `selectedSlug`; the map flies to it and the row scrolls into view —
  one source of truth keeps them in sync.
- **Filters affect both map and list** (same filtered array feeds both) so the
  map never shows pins the list is hiding.
- **First-interaction geolocation** via a one-shot `pointerdown` listener; denial
  centers on the Loop and shows a dismissible banner. Never requested on load.

## Phase 3 — Engine (built before Phase 2)

- **Reordered: engine before map.** Phase 2's score markers and distance sort
  literally depend on the status machine, Steal Score, and haversine. Building
  the engine first (with tests green) means the map renders real data, not
  placeholders. Same commits, dependency order.
- **All time math in "minute of the week" space [0, 10080).** Deriving Chicago
  wall-clock fields via `Intl.DateTimeFormat` (host-tz independent) then working
  modulo a week makes midnight-crossing windows and the Sat→Sun / Sun→Mon wrap
  fall out of `pos` vs `pos + 10080` checks — no fragile Date juggling. 18
  Vitest cases cover it.
- **`bestStatus` breaks LIVE ties by most time left**, so a venue's headline is
  the deal you can still actually catch.
- **One shared 30s heartbeat** (`useTick`) drives every countdown via a single
  module-level interval + subscriber set, not N timers.

## Phase 4 — Detail + favorites

- **Two-level tap model.** Marker tap = highlight + recenter + scroll the row
  into view (keeps the map visible). Row tap = open the full-screen detail
  overlay. This preserves the "marker ↔ sheet sync" requirement while making
  detail a deliberate deeper action, not an accidental full-screen takeover.
- **Detail is a Framer `AnimatePresence` overlay** sliding from the bottom, with
  a per-deal schedule grid (7 day chips), priced item list (null → "—", never a
  fake price), fine print, source link, cash-only badge, verification line, and
  a sticky Directions CTA (`maps.google.com/?daddr=`).
- **Favorites = an All/Saved tab** over the same ranked+filtered list, reading
  the persisted Zustand `favorites`. Empty saved state coaches the heart action.
- **Staleness everywhere**: rows and detail both flag `>45 days` or
  `confidence < 0.6` with "verify before you go" — never hidden, per spec.

## Phase 5 — Pipeline

- **Forced tool-use extraction on `claude-haiku-4-5`, `temperature: 0`.** A
  single `record_deals` tool with `tool_choice: {type:"tool"}` guarantees a
  validated JSON shape; `block.input` is parsed by the SDK and re-checked with
  the `ExtractionSchema` Zod schema before anything is written.
- **Anti-hallucination lives in the system prompt** (SHIP RULE #5): explicit
  prices only, never infer prices/times, no training-data knowledge, no HH →
  `found:false`, max 20 items. Below 0.6 confidence or `found:false` → log and
  keep the old data, never delete.
- **One `runScrape` shared by the CLI and the cron route**, rate-limited to
  ≤1 req/sec, refreshing the 8 stalest venues (or one by `--venue`).
- **Graceful degradation verified.** Dry-run against `sushi-san` with no
  `ANTHROPIC_API_KEY`: the page fetched + stripped via cheerio, the extractor
  no-op'd loudly, existing seed data was kept (seed.json byte-unchanged). No key
  → loud no-op; no secret → cron 503 + `/admin` disabled; no DB → console log.
- **`/admin?key=CRON_SECRET`** shows scrapeable venues + scrape_log with
  per-venue refresh buttons; the log is DB-only (StaticRepo logs to console).

## Phase 6 — Awesome Layer

### 1. BEELINE MODE (the killer demo)
- Full-screen drunk-proof compass: one giant glowing `Navigation2` arrow rotates
  to `bearing(user → bestLiveDeal) − deviceHeading`, distance counts down via
  `watchPosition` as you walk, and within 25 m it flips to "YOU MADE IT".
- `useDeviceHeading` handles both worlds: iOS `webkitCompassHeading` (with the
  `DeviceOrientationEvent.requestPermission()` gesture) and Android
  `deviceorientationabsolute`'s `alpha`. No compass / no permission → arrow goes
  north-relative with an honest heads-up (the spec's no-compass fallback).
- Target = nearest LIVE deal by walk time, falling back to nearest opening-soon.
  FAB only appears when there's a location and a target.

### 3. Tonight's Play
- Pure-engine route planner (no AI): start at the top-ranked LIVE deal, then
  greedily hop to the nearest still-live bar (≤14 min hops, max 3 stops),
  checking each window is still open on arrival via accumulated walk time.
- Estimates total damage from the cheapest drink at each stop and emits a
  shareable text plan (native share sheet → clipboard fallback).

## Phase 7 — Final

### 4. Damage calculator
- Set a budget ($10/$20/$40, persisted); every row computes `floor(budget / cheapest priced drink)` and shows "$20 buys 5 Tallboys" — pure math, zero AI.

## v3 — FULL COVERAGE (HQ anchor, census, lifecycle, planner, scout)

The owner shipped a v3 spec mid-build. Most of v1/v2 carried straight over; this
section logs the new work and judgment calls.

### v3.1 — HQ anchor + venue lifecycle
- **HQ coordinate corrected via Nominatim.** Spec estimate (41.8881, -87.6262)
  was ~130 m off the AMA Plaza building; Nominatim returns 41.8886592,
  -87.627596 — used that, logged here.
- **`distanceFromHqM` precomputed** into seed.json (and by the census script) so
  sort/coverage math never recomputes haversine per render.
- **Venue lifecycle (UNSCOUTED→SCOUTED→EXTRACTED / NO_DEAL_FOUND)** drives both
  the marker visuals (ember → amber dot → full neon score / dim ring) and the
  list rows ("intel pending" / "no posted specials"). The radar visibly lights
  up as the pipeline works — that's the product story, rendered honestly.
- **Anchor toggle (Office/GPS)** re-anchors every distance and the ranking
  instantly; default Office means GPS denial never degrades the core (SHIP RULE
  #7). `worth-the-trip` seed venues (>2 mi: Skylark, Reggies, Carol's) get a
  dashed marker and are excluded from radius coverage stats.
- **StaticRepo merges census.json onto seed.json** (seed wins by normalized-name
  or <60 m proximity); seed stays the only thing persisted back on extract.

### v3.2/v3.3 — The Census + clustering
- **`pnpm census` ran live:** Chicago Business Licenses (Socrata `uupf-x98q`,
  verified resource ID) `within_circle(location, HQ, 3219)` for
  Tavern/Late Hour/Incidental → 1011 unique licensed venues, deduped by
  normalized DBA + address prefix; OSM Overpass added 249 bar/pub/nightclub
  entries (103 websites enriched onto licenses, 18 OSM-only appended).
- **Final census: ~1020 venues**, committed to `data/census.json` so zero-DB
  mode has the whole city. Higher than the spec's 300–800 estimate because the
  "Incidental Activity" license class is broad (hotels, delis) — kept, per spec,
  since that's where many restaurant-bar happy hours live.
- **Tavern/Late Hour → `bar`; Incidental → `restaurant-bar`.** Lifecycle starts
  UNSCOUTED (or SCOUTED if OSM gave a website).
- **supercluster** (radius 64, maxZoom 17) keeps 1029 markers smooth: cluster
  bubbles show count + best inner score and glow red when any inner deal is
  LIVE; tapping a cluster zooms to its expansion zoom. Recomputed on
  move/zoomend from the in-view bbox.
