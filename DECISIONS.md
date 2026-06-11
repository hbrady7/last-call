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

## Phase 5 — Pipeline

## Phase 6 — Awesome Layer

## Phase 7 — Final
