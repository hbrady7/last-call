import { getRepo } from "../repo";
import type { Deal } from "../types";
import { fetchPageText, sleep } from "./fetch";
import { extractDeals } from "./extract";

export interface ScrapeReport {
  venueId: string;
  venueName: string;
  status: "ok" | "no_deal_found" | "fetch_error" | "low_confidence";
  note?: string;
  dealsWritten: number;
}

/**
 * Refresh the N stalest venues that have a dealSourceUrl. Rate-limited to
 * ≤1 request/sec. On ok + confidence ≥ 0.6 it atomically replaces that venue's
 * happy_hour deals; anything else logs and keeps the existing data (never deletes).
 */
export async function runScrape(opts: {
  limit?: number;
  slug?: string;
}): Promise<ScrapeReport[]> {
  const repo = getRepo();
  const all = await repo.getVenuesWithDeals();
  let targets = all.filter((v) => v.dealSourceUrl);

  if (opts.slug) {
    targets = targets.filter((v) => v.slug === opts.slug);
  } else {
    const stale = await repo.getStalestVenues(opts.limit ?? 8);
    const ids = new Set(stale.map((v) => v.id));
    targets = targets.filter((v) => ids.has(v.id));
  }

  const reports: ScrapeReport[] = [];
  for (let i = 0; i < targets.length; i++) {
    const venue = targets[i];
    if (i > 0) await sleep(1100); // ≤ 1 req/sec, politely

    const fetched = await fetchPageText(venue.dealSourceUrl!);
    if (!fetched.ok) {
      await repo.logScrape({ venueId: venue.id, status: "fetch_error", note: fetched.note });
      reports.push({
        venueId: venue.id,
        venueName: venue.name,
        status: "fetch_error",
        note: fetched.note,
        dealsWritten: 0,
      });
      continue;
    }

    const outcome = await extractDeals(venue.name, fetched.text);
    if (outcome.status !== "ok" || !outcome.extraction) {
      // A clean "nothing posted" advances the venue to NO_DEAL_FOUND; transient
      // fetch/key errors leave the lifecycle untouched to retry later.
      if (outcome.status === "no_deal_found") {
        await repo.setScoutResult(venue.id, { lifecycle: "NO_DEAL_FOUND" });
      }
      await repo.logScrape({
        venueId: venue.id,
        step: "extract",
        status: outcome.status,
        note: outcome.note,
      });
      reports.push({
        venueId: venue.id,
        venueName: venue.name,
        status: outcome.status,
        note: outcome.note,
        dealsWritten: 0,
      });
      continue;
    }

    const now = new Date().toISOString();
    const deals: Deal[] = outcome.extraction.deals.map((d, idx) => ({
      id: `${venue.id}-scraped-${idx}`,
      venueId: venue.id,
      kind: d.kind,
      days: d.days,
      startTime: d.startTime,
      endTime: d.endTime,
      items: d.items,
      finePrint: d.finePrint,
      sourceUrl: venue.dealSourceUrl,
      confidence: outcome.extraction!.confidence,
      lastVerified: now,
    }));

    await repo.replaceHappyHourDeals(venue.id, deals);
    await repo.setScoutResult(venue.id, { lifecycle: "EXTRACTED" });
    await repo.logScrape({
      venueId: venue.id,
      step: "extract",
      status: "ok",
      note: `${deals.length} deals @ conf ${outcome.extraction.confidence}`,
    });
    reports.push({
      venueId: venue.id,
      venueName: venue.name,
      status: "ok",
      dealsWritten: deals.length,
    });
  }

  return reports;
}
