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
  token is available, so the repo cannot be auto-created. SSH push works for
  hbrady7. The Vercel CLI is not authenticated. The build proceeds locally with
  the SSH remote wired (`git@github.com:hbrady7/last-call.git`); the owner
  creates the GitHub repo + links Vercel to enable auto-deploy. Per SHIP RULES,
  missing credentials degrade gracefully and never block the build.

## Phase 1 — Data layer

## Phase 2 — Map + sheet

## Phase 3 — Engine

## Phase 4 — Detail + favorites

## Phase 5 — Pipeline

## Phase 6 — Awesome Layer

## Phase 7 — Final
