import { NextResponse } from "next/server";
import { EventsFileSchema } from "@/lib/types";
import eventsJson from "../../../../data/events.json";

export const dynamic = "force-dynamic";

/**
 * Public read endpoint for Chicago happenings. Ships from the committed
 * data/events.json — zero env vars, same as the venue census. Validates on the
 * way out so a malformed hand-edit fails loud rather than poisoning the client.
 */
export async function GET() {
  try {
    const parsed = EventsFileSchema.parse(eventsJson);
    return NextResponse.json(
      { events: parsed.events, count: parsed.events.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/events] failed:", err);
    return NextResponse.json(
      { events: [], count: 0, error: "Failed to load events." },
      { status: 500 }
    );
  }
}
