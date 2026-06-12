import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";

/**
 * "Report bad intel" — a user flags a venue whose posted deal looks wrong.
 * Writes to scrape_log (step: report), which surfaces in /admin and lets the
 * next cron batch auto-queue a re-extraction. No-DB mode logs to the console.
 */
export async function POST(req: Request) {
  let venueId = "";
  let note = "user-reported bad intel";
  try {
    const body = await req.json();
    venueId = String(body.venueId ?? "");
    if (body.note) note = `user: ${String(body.note).slice(0, 200)}`;
  } catch {
    /* empty body */
  }
  if (!venueId) {
    return NextResponse.json({ ok: false, error: "venueId required" }, { status: 400 });
  }
  try {
    await getRepo().logScrape({
      venueId,
      step: "extract",
      status: "reported",
      note,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "log failed" },
      { status: 500 }
    );
  }
}
