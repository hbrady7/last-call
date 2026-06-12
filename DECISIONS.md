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

### v3.4 — The Planner (/plan)
- **Beam search (width 5)** over EXTRACTED venues: each leg's candidates are
  reachable within the per-leg walk cap and live on arrival with ≥20 min left;
  leg score = stealScore × windowFit − walk×1.5. all_day dives naturally fill
  late legs (their window spans the night). Damage = 2 drinks/stop × cheapest
  anchor (+ food when budget allows).
- **Unit-tested to the DoD:** Wed 4:45 PM from HQ on seed data alone returns a
  valid 3-stop run (Gilt's 15-min remainder correctly disqualifies it as opener;
  the search picks a still-open HH → HH → all_day-dive chain). 22 tests green.
- **Shuffle** re-runs excluding the current opener; **share** emits a text block
  (native share → clipboard); **save** persists the plan locally (Zustand).
- **Lock-a-stop was cut** (SHIP RULE #2): pinning a stop requires the beam to
  plan around a fixed waypoint, which fought the clean leg-by-leg model for
  >30 min. Shuffle + save cover the core need; logged rather than half-built.
- **Optional Haiku hype intro** deferred to the templated intro for now (no new
  required env var; the AI version can slot into the same field when a key is
  present).

### v3.5 — Perfect-match search
- **Keyless client phrase parser** maps natural phrases to a filter object:
  category words (martini→cocktail, draft→beer…), `$N`/`under N` → maxPrice,
  now/open/tonight → liveNow, patio/dive/live-music → tags, leftover → name
  match. Generous stopword list keeps fillers ("late", "open", "spot") from
  becoming spurious name filters. Composes with the chip filters and drives both
  list and map. Optional Haiku refinement is a future slot; the keyword path is
  the always-on floor (SHIP RULE #4).

### v3.6 — Scout pipeline + coverage dashboard
- **Scout step** (`pnpm scout`, cap 25, oldest UNSCOUTED first): one
  `claude-haiku-4-5` call with the **web_search server tool** finds the official
  site + specials URL, rejecting an aggregator blocklist (Yelp/Google/FB/
  OpenTable/TimeOut/…). pause_turn is handled with a short continuation loop;
  the JSON answer is Zod-validated. Success → lifecycle SCOUTED. No key → no-op.
- **Cron** now scouts 15 then extracts 15 per tick; `vercel.json` schedule moved
  to `0 14 * * 1,4` (Mon + Thu, 9 AM Chicago).
- **/admin is a coverage dashboard**: scouted/extracted % bars, lifecycle +
  deal counts over the 2-mile ring, a "run next batch (scout 10 + extract 10)"
  button (DB-only, with a clear note in static mode), per-venue refresh, and the
  step-tagged scrape_log. The product story — the city lighting up — is now
  legible to the operator.

### v3 Awesome — #5 Time scrubber
- Drag 11 AM → 2 AM and pick any weekday; the whole map relights because the
  scrubbed `Date` simply replaces `now` everywhere (`now = scrub ?? tick`). Pure
  status-machine, zero data fetch. After-midnight times fold onto the high end
  of the slider so a Friday 1 AM preview works. "Back to live" clears it.
- Carried over from v2 and still live: BEELINE MODE, Radar sweep, Tonight's
  Play, Damage calculator — 5 Awesome features total, BEELINE first.

## v3 — FINAL
- **OG image via `next/og`** (edge `ImageResponse`, no extra dep) renders the
  neon wordmark at 1200×630; `app/icon.svg` is the favicon. Apple-touch-icon
  repointed to the existing SVG (the referenced PNG never existed).
- **README rewritten** as a full operator guide: zero-env promise, Neon + Vercel
  cron setup, census re-run, pipeline ops, Steal Score + planner math, the
  Awesome inventory, and how to hand-add a venue.
- **Lighthouse** couldn't be run headless in this build environment, but the
  quality floor is built in: mobile-first viewport, `theme-color`, semantic
  headings, tap targets ≥40 px, reduced-motion kills every flicker/pulse/sweep,
  GPS denial anchors on the Office and never breaks, and the map is clustered so
  1000+ markers stay smooth. All routes return 200 (`/`, `/plan`, `/admin`,
  `/api/venues`, `/opengraph-image`, `/icon.svg`).
- **Final state:** zero-env build serves 1,029 venues with honest lifecycle
  states; 22 engine + planner tests green; pipeline scouts/extracts under hard
  caps and never invents a price; 5 Awesome features live (BEELINE first).

## Phase 8 — Cheapest-first + Chicago events

- **Cheapest pour is now the primary sort key.** `compareRanked` leads with the
  absolute cheapest priced drink across a venue's deals (`cheapestDrinkPrice`,
  food excluded); ties break on LIVE status → Steal Score → walk. Venues with no
  priced drink keep the old `rankValue` ordering and sink below the priced ones,
  so the map's lifecycle story survives at the bottom. Steal Score stays as a
  secondary signal — demoted from the row's hero badge to a small ⚡ chip.
- **Events ship as committed JSON, same as the census.** `data/events.json` is a
  hand-curated, coordinate-verified set of real Chicago happenings (Cubs/Sox,
  Lolla, Blues Fest, Second City, Salt Shed, …) dated across summer 2026.
  Zero-env, validated on the way out of `/api/events` via `EventsFileSchema`.
  Live-ticketing APIs were rejected: they'd break the "works with no keys"
  promise. Dates are representative and refreshable by the pipeline.
- **Seamless = one map, events as the anchor.** Events render as cyan marquee
  pins above the amber deal pins, a "Tonight in Chicago" rail rides the bottom
  sheet, and tapping any event opens a pre-game sheet whose body is the cheapest
  pours nearby (`pregameDeals`: within an 18-min walk sorted cheapest-first,
  backfilled by nearest so far-flung venues like Wrigley still get a list).
  Toggle in the header; on by default; persisted.
- **DealRow redesigned around the price.** A rounded "$4 / pour" tile is the hero
  element, colored red/amber/brass by live status — the cheapest-first thesis
  made visible at a glance. Class badge dropped to declutter.
- **Verified:** typecheck + lint clean, 22 tests green, production build passes,
  `/api/events` serves 25 events, and the live `/api/venues` payload sorts
  $4 (Richard's/Skylark/Carol's) → up.

## v4 — "Best Drinking App in Chicago" overhaul

The mandate flipped from feature-list to product: a 22-year-old opens this at
4:50 PM Wednesday and knows in three seconds where to go.

### The three-second screen (Phase B)
- **Lead with the answer.** A `RIGHT NOW` strip (`RightNowStrip`) renders the
  top-3 live picks — price, walk, ends-in, one-tap directions — plus a Plan
  card, *before any control*. It reads the already-cheapest-first `ranked` set,
  so it's the same engine truth as the list, just hoisted.
- **Killed the vanity metric.** `liveStats`/`liveStatsLine` replace "1029 deals"
  (a census venue count) with "N live now · M within a 10-min walk", ticking
  with the clock. The live count is a button that cycles the camera through
  live venues (reuses `select` → map flyTo + row scroll).
- **Collapsed the control wall.** Search + a single Filters button (`FilterSheet`
  holds chips + budget + events toggle) + a budget pill that cycles presets.
  Search placeholder examples became tappable chips. Plus a Spin chip for the
  Wheel.
- **LIVE dominates the map.** Clusters now reduce a live *count* (not a boolean)
  and render it big + red with a pulse; dead clusters drop to 45% opacity and
  shrink. `FitRingOnce` frames the anchor + full 2-mile ring on load.
- **Windowed list** via `useWindowed` (IntersectionObserver) keeps ~1,000 rows
  cheap. Labeled top controls (Locate / anchor / Time travel) — no mystery meat.

### Data quality (Phase C)
- `scripts/qa.ts` (`pnpm qa`): price sanity bands, duplicate merge, schedule
  nonsense, stale sweep; report by default, `--fix` writes. Seed is clean
  (14 → 14, 0 flags) — reported honestly. `Deal.needsReview` excludes flagged
  intel from the cheapest-drink key and the headline status; rendered with an
  "unverified" tag. `/api/report` + `ReportIntel` queue a re-check via scrape_log.

### Events provenance — Invariant 3 (Phase D)
- The v1 events rail had real URLs but fabricated "representative" dates — that
  was the violation. Fix: `CityEvent` gains `source`/`fetchedAt`/`verified`.
  `scripts/events-mlb.ts` pulls real Cubs (112) + Sox (145) home games from the
  **free, keyless MLB StatsAPI** → 94 verified rows. Curated music/festival rows
  are honestly labeled "Curated" in the UI with their source. No fabricated
  temporal data presented as fact. Curated Cubs/Sox stubs deleted (redundant).
- **Handshake Index** (`handshake.ts`): cheapest live Old Style + Malört combo
  within the ring, by literal label match, falling back to cheapest live
  beer+shot labeled "proxy". Chicago's Dow Jones, shown proud at the top of the
  sheet. **Game Day** (`gameday.ts`): bars within 1 km of a ballpark with a home
  game today get a ⚾ pennant + row tag.

### Troll energy (Phase E)
- `lib/voice.ts`: deterministic, day-seeded copy (empty/error/loading/lore/
  roasts/dares). Punches at prices, Malört, and the user's own choices — never
  at people; destructive flows stay straight-faced. `Math.random` avoided so the
  voice is testable and stable within a day.
- **Roast My Plan** (`/api/roast`): key-optional. Haiku (temp 0.8, 80-token hard
  cap, `VOICE_RULES` embedded) roasts the *plan*; no key → canned roast.
- **Wheel of Poor Decisions** (rebrands the Malört-roulette idea): neon slot reel
  spins open dives ≤20-min walk, shake-to-spin via devicemotion, day-seeded dare.

### Liberty (Phase F)
- **Onboarding**: one 3-second neon flicker-on + radar sweep on first open,
  tap-to-skip, never again (localStorage), reduced-motion → instant utility.
- **Meme share cards** (`/share` OG route): Summon / Receipt / Challenge
  templates; planner Share fires the native sheet with a Summon card URL.

### Scope cuts (logged honestly)
- **CTA L-leg planner insert** (Phase D.4): not built this pass — kept the
  planner keyless + deterministic rather than ship a half-wired transit
  estimate. The nearest-station display + L-leg heuristic are the next slice.
- **Badge collectible screen / Receipt auto-share** (Phase E.5): the share
  template exists; wiring earned badges into it is deferred. No dead code left.
- **Per-marker meme OG previews + full Lighthouse run**: headless visual tooling
  (screenshots, Lighthouse) doesn't run in this build sandbox — verified instead
  via green build, 31 tests, and a runtime smoke test of every route (all 200).

**Final state:** zero-env build serves 1,029 venues + 116 events (94 verified);
31 tests green; typecheck + lint clean; production build passes. The answer
leads, counts are honest, LIVE dominates, events have provenance, and the app
has a mouth on it.
