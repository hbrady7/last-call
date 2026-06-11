"use client";
import { cn } from "@/lib/utils";
import type { RankedVenue } from "@/lib/engine/rank";
import { formatWalk } from "@/lib/engine/distance";
import { ScoreBadge } from "./ScoreBadge";
import { CountdownChip } from "./CountdownChip";
import { Heart } from "./Heart";
import { AlertTriangle, Wallet } from "lucide-react";
import { useStore } from "@/store/useStore";

/** "$20 → 5 Tallboys" — pure math off the cheapest priced drink. */
function whatBudgetBuys(ranked: RankedVenue, budget: number): string | null {
  const items = ranked.headlineDeal?.items ?? [];
  const drinks = items.filter((i) => i.price != null && i.category !== "food");
  if (drinks.length === 0) return null;
  const cheapest = drinks.reduce((a, b) =>
    (a.price as number) <= (b.price as number) ? a : b
  );
  const count = Math.floor(budget / (cheapest.price as number));
  if (count < 1) return `not quite one ${cheapest.label.toLowerCase()}`;
  return `${count} ${cheapest.label}${count > 1 ? "s" : ""}`;
}

export function DealRow({
  ranked,
  now,
  selected,
  onSelect,
}: {
  ranked: RankedVenue;
  now: Date;
  selected: boolean;
  onSelect: (slug: string) => void;
}) {
  const { venue, status, score, meters, headline, stale } = ranked;
  const budget = useStore((s) => s.budget);
  const buys = budget != null ? whatBudgetBuys(ranked, budget) : null;
  return (
    <button
      type="button"
      onClick={() => onSelect(venue.slug)}
      className={cn(
        "flex w-full items-center gap-3 rounded-coaster border px-3 py-3 text-left transition-colors",
        selected
          ? "border-neon-amber/60 bg-surface-2"
          : "border-transparent bg-surface hover:bg-surface-2"
      )}
    >
      <ScoreBadge score={score} state={status.state} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[15px] text-cream">
            {venue.name}
          </span>
          {venue.cashOnly && (
            <span className="shrink-0 rounded bg-brass/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brass">
              Cash
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[13px] text-brass">{headline}</div>
        <div className="mt-1.5 flex items-center gap-2">
          <CountdownChip status={status} now={now} />
          <span className="truncate text-[11px] text-muted">
            {venue.neighborhood}
            {meters != null && ` · ${formatWalk(meters)}`}
          </span>
        </div>
        {buys && (
          <div className="tabular mt-1 inline-flex items-center gap-1 text-[11px] text-neon-amber">
            <Wallet className="h-3 w-3" /> ${budget} buys {buys}
          </div>
        )}
        {stale && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-neon-amber/80">
            <AlertTriangle className="h-3 w-3" /> verify before you go
          </div>
        )}
      </div>
      <Heart venueId={venue.id} />
    </button>
  );
}
