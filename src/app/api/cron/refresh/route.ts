import { NextResponse } from "next/server";
import { runScrape } from "@/lib/scraper/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled refresh of the 8 stalest venues. Guarded by CRON_SECRET (Bearer).
 * No secret configured → 503 with setup help (never silently runs unguarded).
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
    const reports = await runScrape({ limit: 8 });
    const ok = reports.filter((r) => r.status === "ok").length;
    return NextResponse.json({ ran: reports.length, updated: ok, reports });
  } catch (e) {
    console.error("[cron/refresh] failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "refresh failed" },
      { status: 500 }
    );
  }
}
