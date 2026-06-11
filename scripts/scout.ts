/**
 * Scout step. Usage: pnpm scout
 * Web-searches the 25 oldest UNSCOUTED venues for their official site +
 * specials page, advancing them to SCOUTED. Requires ANTHROPIC_API_KEY (+ a DB
 * to persist results); no key → loud no-op.
 */
import "dotenv/config";
import { runScout } from "../src/lib/scraper/scout";

async function main() {
  console.log("Scouting up to 25 UNSCOUTED venues…");
  const reports = await runScout(25);
  if (reports.length === 0) console.log("Nothing to scout (or no API key).");
  for (const r of reports) {
    const mark = r.status === "ok" ? "✓" : "·";
    console.log(
      `${mark} ${r.venueName} → ${r.status}${r.dealSourceUrl ? ` · ${r.dealSourceUrl}` : ""}${r.note ? ` (${r.note})` : ""}`
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Scout failed:", e);
  process.exit(1);
});
