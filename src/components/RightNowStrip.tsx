"use client";
import Link from "next/link";
import { Navigation, CalendarRange, Footprints } from "lucide-react";
import type { RankedVenue } from "@/lib/engine/rank";
import { CountdownChip } from "./CountdownChip";

/** Top live picks for the current anchor — the answer, rendered before any control. */
function topLivePicks(ranked: RankedVenue[], limit = 3): RankedVenue[] {
  return ranked
    .filter(
      (r) =>
        r.status.state === "LIVE" &&
        r.cheapestDrink != null &&
        r.venue.lat != null &&
        r.venue.lng != null
    )
    .slice(0, limit); // ranked is already cheapest-first
}

function directionsHref(v: RankedVenue["venue"]): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`;
}

export function RightNowStrip({
  ranked,
  now,
  onSelect,
}: {
  ranked: RankedVenue[];
  now: Date;
  onSelect: (slug: string) => void;
}) {
  const picks = topLivePicks(ranked);
  if (picks.length === 0) return null;

  return (
    <section
      aria-label="Right now — top live picks"
      className="pointer-events-auto absolute inset-x-0 z-[1090] px-3"
      style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}
    >
      <div className="mb-1 flex items-center gap-2 px-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live-red" />
        <span className="font-display text-[11px] uppercase tracking-[0.2em] text-live-red">
          Right Now
        </span>
      </div>
      <div className="no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1">
        {picks.map((r, i) => (
          <article
            key={r.venue.id}
            className="w-[200px] shrink-0 snap-start rounded-coaster border border-live-red/40 bg-ink/92 p-3 shadow-[0_0_18px_rgba(255,69,48,0.18)] backdrop-blur"
          >
            <button
              type="button"
              onClick={() => onSelect(r.venue.slug)}
              className="block w-full text-left"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-display text-[15px] text-cream">
                  {r.venue.name}
                </span>
                <span className="tabular shrink-0 text-[17px] font-bold text-live-red neon-red">
                  ${r.cheapestDrink}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-brass">
                <CountdownChip status={r.status} now={now} />
                {r.walkMin != null && (
                  <span className="tabular inline-flex items-center gap-1 text-muted">
                    <Footprints className="h-3 w-3" />
                    {Math.max(1, Math.round(r.walkMin))}m
                  </span>
                )}
              </div>
            </button>
            <a
              href={directionsHref(r.venue)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-full border border-live-red/40 bg-live-red/10 py-1.5 text-[12px] font-semibold text-live-red active:scale-[0.98]"
              aria-label={`Directions to ${r.venue.name}`}
            >
              <Navigation className="h-3.5 w-3.5" fill="currentColor" />
              {i === 0 ? "Go now" : "Directions"}
            </a>
          </article>
        ))}
        {/* The 4th card: a whole night, one tap. */}
        <Link
          href="/plan"
          className="flex w-[150px] shrink-0 snap-start flex-col justify-between rounded-coaster border border-neon-amber/40 bg-neon-amber/8 p-3 text-neon-amber active:scale-[0.99]"
        >
          <CalendarRange className="h-5 w-5" />
          <span className="font-display text-[14px] leading-tight">
            Plan a whole night →
          </span>
        </Link>
      </div>
    </section>
  );
}
