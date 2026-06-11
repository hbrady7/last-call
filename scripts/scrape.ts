/**
 * Manual scraper. Usage:
 *   pnpm scrape                 # refresh the 8 stalest venues with a dealSourceUrl
 *   pnpm scrape --venue <slug>  # refresh a single venue
 *
 * No ANTHROPIC_API_KEY → extraction no-ops loudly and existing data is kept.
 */
import "dotenv/config";
import { runScrape } from "../src/lib/scraper/run";

async function main() {
  const args = process.argv.slice(2);
  const vIdx = args.indexOf("--venue");
  const slug = vIdx >= 0 ? args[vIdx + 1] : undefined;

  console.log(slug ? `Scraping venue: ${slug}` : "Scraping 8 stalest venues…");
  const reports = await runScrape({ slug, limit: 8 });

  if (reports.length === 0) {
    console.log("No venues matched (none have a dealSourceUrl, or slug not found).");
  }
  for (const r of reports) {
    const mark = r.status === "ok" ? "✓" : "·";
    console.log(
      `${mark} ${r.venueName} → ${r.status}${r.note ? ` (${r.note})` : ""}${
        r.dealsWritten ? ` · wrote ${r.dealsWritten} deals` : ""
      }`
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Scrape failed:", e);
  process.exit(1);
});
