"use client";
import type { Handshake } from "@/lib/engine/handshake";

/** Chicago's Dow Jones — the cheapest beer+shot handshake live right now. */
export function HandshakeIndex({
  handshake,
  onSelect,
}: {
  handshake: Handshake | null;
  onSelect: (slug: string) => void;
}) {
  if (!handshake) return null;
  const { venue, beer, shot, total, exact } = handshake;
  return (
    <button
      type="button"
      onClick={() => onSelect(venue.slug)}
      className="mx-4 mb-2 flex w-[calc(100%-2rem)] items-center gap-2.5 rounded-coaster border border-brass/30 bg-surface/80 px-3 py-2 text-left"
    >
      <span className="text-base leading-none">🤝</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[10px] uppercase tracking-[0.18em] text-brass">
            The Handshake
          </span>
          {!exact && (
            <span className="rounded bg-brass/15 px-1 py-px text-[8px] uppercase tracking-wide text-muted">
              proxy
            </span>
          )}
        </div>
        <div className="tabular truncate text-[12px] text-cream">
          <span className="font-semibold text-neon-amber">${total}</span> ·{" "}
          {beer.label} + {shot.label} @ {venue.name}
        </div>
      </div>
      <span className="tabular shrink-0 text-[10px] text-live-red">live</span>
    </button>
  );
}
