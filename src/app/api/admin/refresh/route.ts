import { NextResponse } from "next/server";
import { runScrape } from "@/lib/scraper/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Per-venue refresh trigger for /admin. Guarded by CRON_SECRET (?key=). */
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
  const slug = url.searchParams.get("slug") ?? undefined;

  try {
    const reports = await runScrape({ slug, limit: 8 });
    return NextResponse.json({ reports });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "refresh failed" },
      { status: 500 }
    );
  }
}
