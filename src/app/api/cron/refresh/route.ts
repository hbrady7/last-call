import { NextResponse } from "next/server";
import { runScrape } from "@/lib/scraper/run";
import { runScout } from "@/lib/scraper/scout";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled pipeline tick: scout 15 UNSCOUTED venues, then extract 15 stalest.
 * Guarded by CRON_SECRET (Bearer). No secret → 503 with setup help (never runs
 * unguarded).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secret.trim()) {
    return NextResponse.json(
      {
        error: "CRON_SECRET is not configured.",
        help: "Set CRON_SECRET in your environment to enable the refresh cron. The app works fine without it — this endpoint just stays disabled.",
      },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scouted = await runScout(15);
    const extracted = await runScrape({ limit: 15 });
    return NextResponse.json({
      scouted: {
        ran: scouted.length,
        found: scouted.filter((r) => r.status === "ok").length,
      },
      extracted: {
        ran: extracted.length,
        updated: extracted.filter((r) => r.status === "ok").length,
      },
      reports: { scout: scouted, extract: extracted },
    });
  } catch (e) {
    console.error("[cron/refresh] failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "refresh failed" },
      { status: 500 }
    );
  }
}
