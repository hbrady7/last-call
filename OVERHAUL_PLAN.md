# OVERHAUL_PLAN — Last Call v4 ("Best Drinking App in Chicago")

This is the contract for the v4 overhaul. The bar: a 22-year-old opens this at
4:50 PM on a Wednesday and knows in **three seconds** where to go.

---

## (a) Inventory — what shipped vs the v3 spec

| Area | State | Notes |
|---|---|---|
| Data layer (Zod + Drizzle + StaticRepo) | ✅ solid | 18 seed venues, 14 verified deals; 1,020-venue census merged on top (909 UNSCOUTED, 111 SCOUTED) |
| Deal engine (status machine, Steal Score, cheapest-first rank) | ✅ solid | `status.ts` / `score.ts` / `rank.ts`, 22 tests green |
| Map (Leaflet CARTO dark + supercluster + lifecycle markers) | ✅ | clusters carry `hasLive`, but it reads as a faint border — not dominant |
| Bottom sheet + filters + budget + search | ✅ but stacked | the control wall: search → "N deals" → 8 chips → budget → plan → events rail, **before any answer** |
| Planner (`/plan`, beam search) | ✅ | standalone page; not events-aware |
| Events rail | ⚠️ provenance gap | 25 curated rows, real URLs but **representative (fabricated) dates**, no `fetchedAt` |
| AI pipeline (Haiku extract, scout, cron, /admin) | ✅ | zero-key degrades cleanly |
| Awesome features (BEELINE, radar sweep, Tonight's Play, damage calc, time scrubber) | ✅ | all live |

## (b) Provenance audit — events

The v1 events rail was a good instinct but **fails Invariant 3 as now extended
to events**: `data/events.json` carries real venue coordinates and real
homepage URLs, but the `start`/`end` datetimes are hand-authored
"representative of the summer-2026 season" — i.e. not sourced, not timestamped,
no `fetchedAt`. That is fabricated temporal data presented as fact.

**Fix (Phase D):**
1. Extend `CityEvent` with `source` (human label) + `fetchedAt` (ISO) +
   `verified` (boolean). Unknown stays unknown.
2. Wire a real, free, keyless source: the **MLB StatsAPI**
   (`statsapi.mlb.com`, no key) for Cubs (team 112) + Sox (145) home games via
   `scripts/events-mlb.ts`. Those rows get `verified: true`.
3. Curated music/festival/comedy rows are **honestly labeled "Curated"** in the
   UI (a small tag), not dressed as live data. Anything that can't carry a
   source or an honest curated label gets cut.

## (c) Data-quality findings (Phase C)

Most census venues are UNSCOUTED (no deals) so the junk surface today is small,
but the moment the AI pipeline runs at scale it explodes. `pnpm qa` ships now as
the guardrail: price sanity bands, duplicate merge, schedule-nonsense flags,
stale sweep, and a "report bad intel" path that writes to the scrape log. Deal
type gains an optional `needsReview` flag; flagged deals render an "unverified"
tag and are excluded from scoring until re-verified. Before/after counts logged
below.

## (d) Top-10 UX problems (ranked)

1. **No answer above the fold.** Seven controls render before a single bar.
2. **Vanity metric.** "1029 deals" is a census venue count, not live deals —
   meaningless and misleading.
3. **Control wall.** Search + 8 filter chips + budget + plan button + events
   rail all compete for the first screen.
4. **LIVE doesn't dominate the map.** Every cluster is a near-identical beige
   circle; urgency is encoded in a border nobody sees.
5. **Camera drifts.** Default view doesn't frame the anchor + ring tightly.
6. **Mystery-meat icons.** Top-right buttons have no visible labels.
7. **Events bolted on, not integrated.** A rail, not a planning primitive.
8. **No personality.** Generic empty/error/loading copy; no group-chat ammo.
9. **Plan is a separate page**, not reachable as one tap from the answer.
10. **Perf risk.** ~1,000 rows un-windowed in the sheet.

## (e) The overhaul plan (execution order)

- **Phase A** — this document. ✅
- **Phase E.0** — `lib/voice.ts` (deterministic, day-seeded copy system) first,
  so every screen below speaks in one voice.
- **Phase B** — The Three-Second Screen: a `RIGHT NOW` hero strip (top-3 live
  picks + walk + ends-in + directions, plus a "Plan a whole night" card),
  status-aware counts, a single collapsed control row (search + Filters sheet +
  budget pill), tappable example chips, live-dominant clusters with a
  cycle-through-live pill, labeled controls, tight default camera, windowed list.
- **Phase C** — `pnpm qa` + report-bad-intel + `needsReview` tagging.
- **Phase D** — Events provenance + MLB source + Game Day flag + Handshake Index
  + events-as-plan-stops ("Drinks near this").
- **Phase E** — Voice everywhere + meme-grade share cards + Wheel of Poor
  Decisions + badges with teeth + lore drops + Roast My Plan (key-optional).
- **Phase F** — Liberty improvements (≥3) from the problem list.
- **Phase G** — tests, Lighthouse posture, README, closeout.

Subtraction is encouraged: anything that doesn't earn its screen space gets cut
and logged, removed cleanly.

---

## Before / after log (filled per phase)

_(updated as phases land)_
