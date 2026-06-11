import { NextResponse } from "next/server";
import { runScrape } from "@/lib/scraper/run";
import { runScout } from "@/lib/scraper/scout";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * /admin actions. Guarded by CRON_SECRET (?key=).
 *  ?slug=<slug>  → re-extract one venue
 *  ?batch=1      → run the next pipeline batch (scout 10 + extract 10)
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secret.trim()) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 }
    );
  }
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (url.searchParams.get("batch")) {
      const scout = await runScout(10);
      const extract = await runScrape({ limit: 10 });
      return NextResponse.json({
        scoutFound: scout.filter((r) => r.status === "ok").length,
        scoutRan: scout.length,
        extractUpdated: extract.filter((r) => r.status === "ok").length,
        extractRan: extract.length,
      });
    }
    const slug = url.searchParams.get("slug") ?? undefined;
    const reports = await runScrape({ slug, limit: 8 });
    return NextResponse.json({ reports });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "refresh failed" },
      { status: 500 }
    );
  }
}
