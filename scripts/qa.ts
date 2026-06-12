/* ───────────────────────────── pnpm qa ────────────────────────────────────
   Data-quality guardrail over the deal corpus. A thousand AI-extracted deals
   guarantee junk; this is the sieve. Reports by default, writes flags/merges
   with `--fix`.

   Checks:
     • price sanity bands per category  → flag needs_review
     • duplicate deals per venue        → merge (same kind + overlapping window)
     • schedule nonsense                → flag (end≤start handled as midnight-cross,
                                           0-day arrays, happy_hour windows >8h)
     • stale sweep                      → list deals lastVerified >45 days

   Usage:  pnpm qa            (report only)
           pnpm qa --fix      (apply flags + merges to data/seed.json)
*/
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SeedSchema, type Deal } from "../src/lib/types";
import { windowHours } from "../src/lib/engine/score";

const FIX = process.argv.includes("--fix");
const SEED_PATH = fileURLToPath(new URL("../data/seed.json", import.meta.url));

/** [min, max] believable price per category, in dollars. */
const BANDS: Record<string, [number, number]> = {
  beer: [1, 12],
  wine: [3, 20],
  cocktail: [4, 25],
  shot: [1, 15],
  food: [1, 30],
};

const STALE_DAYS = 45;
const MAX_HH_HOURS = 8;

type Issue = { dealId: string; venueId: string; kind: string; detail: string };

function priceOutliers(deal: Deal): string[] {
  const out: string[] = [];
  for (const i of deal.items) {
    if (i.price == null) continue;
    const band = BANDS[i.category];
    if (!band) continue;
    if (i.price < band[0] || i.price > band[1]) {
      out.push(`${i.category} $${i.price} outside $${band[0]}–${band[1]} (${i.label})`);
    }
  }
  return out;
}

function scheduleNonsense(deal: Deal): string[] {
  const out: string[] = [];
  if (deal.kind === "happy_hour") {
    if (deal.days.length === 0) out.push("0-day array on a happy_hour");
    if (deal.startTime == null || deal.endTime == null) {
      out.push("happy_hour missing start/end time");
    } else {
      const h = windowHours(deal);
      if (h <= 0) out.push("window collapses to 0h");
      if (h > MAX_HH_HOURS) out.push(`window ${h.toFixed(1)}h > ${MAX_HH_HOURS}h`);
    }
  }
  return out;
}

/** Two deals overlap if same kind, intersecting days, and overlapping windows. */
function overlaps(a: Deal, b: Deal): boolean {
  if (a.kind !== b.kind) return false;
  const sharedDay = a.days.some((d) => b.days.includes(d));
  if (!sharedDay) return false;
  if (a.kind === "all_day") return true;
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

function mergeItems(a: Deal, b: Deal): Deal["items"] {
  const seen = new Set<string>();
  const items: Deal["items"] = [];
  for (const i of [...a.items, ...b.items]) {
    const key = `${i.category}:${i.label.toLowerCase()}:${i.price ?? "?"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(i);
  }
  return items;
}

async function main() {
  const raw = JSON.parse(await readFile(SEED_PATH, "utf8"));
  const seed = SeedSchema.parse(raw);
  let deals = [...seed.deals];

  const before = deals.length;
  const flagged: Issue[] = [];
  const stale: Issue[] = [];

  // 1. duplicate merge (per venue)
  const byVenue = new Map<string, Deal[]>();
  for (const d of deals) {
    const arr = byVenue.get(d.venueId) ?? [];
    arr.push(d);
    byVenue.set(d.venueId, arr);
  }
  const dropped = new Set<string>();
  let merges = 0;
  for (const arr of byVenue.values()) {
    for (let i = 0; i < arr.length; i++) {
      if (dropped.has(arr[i].id)) continue;
      for (let j = i + 1; j < arr.length; j++) {
        if (dropped.has(arr[j].id)) continue;
        if (overlaps(arr[i], arr[j])) {
          arr[i].items = mergeItems(arr[i], arr[j]);
          arr[i].days = Array.from(new Set([...arr[i].days, ...arr[j].days])).sort();
          dropped.add(arr[j].id);
          merges++;
        }
      }
    }
  }
  deals = deals.filter((d) => !dropped.has(d.id));

  // 2. price + schedule flags  3. stale sweep
  const now = Date.now();
  for (const d of deals) {
    const reasons = [...priceOutliers(d), ...scheduleNonsense(d)];
    if (reasons.length) {
      d.needsReview = true;
      for (const r of reasons)
        flagged.push({ dealId: d.id, venueId: d.venueId, kind: d.kind, detail: r });
    } else if (d.needsReview) {
      d.needsReview = false; // cleared on re-verify
    }
    const ageDays = (now - new Date(d.lastVerified).getTime()) / 86_400_000;
    if (ageDays > STALE_DAYS) {
      stale.push({
        dealId: d.id,
        venueId: d.venueId,
        kind: d.kind,
        detail: `${Math.round(ageDays)}d old — queued for next cron batch`,
      });
    }
  }

  // ── report ──
  console.log("\n=== pnpm qa — data quality report ===");
  console.log(`deals before: ${before}`);
  console.log(`duplicate merges: ${merges}`);
  console.log(`deals after merge: ${deals.length}`);
  console.log(`flagged needs_review: ${flagged.length}`);
  for (const f of flagged) console.log(`  ⚑ ${f.venueId}/${f.dealId}: ${f.detail}`);
  console.log(`stale (>${STALE_DAYS}d): ${stale.length}`);
  for (const s of stale) console.log(`  ⌛ ${s.venueId}/${s.dealId}: ${s.detail}`);

  if (FIX) {
    await writeFile(
      SEED_PATH,
      JSON.stringify({ venues: seed.venues, deals }, null, 2) + "\n"
    );
    console.log(`\n✓ wrote ${deals.length} deals back to data/seed.json`);
  } else {
    console.log("\n(report only — run `pnpm qa --fix` to apply flags + merges)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
