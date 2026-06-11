import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** Public read endpoint. Serves only mappable venues (coords present). */
export async function GET() {
  try {
    const repo = getRepo();
    const all = await repo.getVenuesWithDeals();
    const venues = all.filter((v) => v.lat != null && v.lng != null);
    return NextResponse.json(
      { venues, count: venues.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/venues] failed:", err);
    return NextResponse.json(
      { venues: [], count: 0, error: "Failed to load venues." },
      { status: 500 }
    );
  }
}
