"use client";
import { cn } from "@/lib/utils";
import type { RankedVenue } from "@/lib/engine/rank";
import type { DealState } from "@/lib/engine/status";
import { formatWalk } from "@/lib/engine/distance";
import { ScoreBadge } from "./ScoreBadge";
import { CountdownChip } from "./CountdownChip";
import { Heart } from "./Heart";
import { AlertTriangle, Wallet, Zap } from "lucide-react";
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

/** The hero tile: the cheapest pour, sized big, colored by how live it is. */
function PriceTile({ price, state }: { price: number; state: DealState }) {
  return (
    <div
      className={cn(
        "tabular grid h-12 w-12 shrink-0 place-items-center rounded-2xl border leading-none",
        state === "LIVE" &&
          "border-live-red/60 bg-live-red/15 text-live-red neon-red",
        state === "STARTS_SOON" &&
          "border-neon-amber/60 bg-neon-amber/15 text-neon-amber",
        (state === "LATER_TODAY" || state === "NOT_TODAY") &&
          "border-brass/40 bg-surface-2 text-brass"
      )}
    >
      <span className="text-[17px] font-bold">${price}</span>
      <span className="mt-0.5 text-[8px] uppercase tracking-wider opacity-70">
        pour
      </span>
    </div>
  );
}

export function DealRow({
  ranked,
  now,
  selected,
  onSelect,
  gameDay = false,
}: {
  ranked: RankedVenue;
  now: Date;
  selected: boolean;
  onSelect: (slug: string) => void;
  gameDay?: boolean;
}) {
  const { venue, status, score, cheapestDrink, meters, headline, stale } = ranked;
  const budget = useStore((s) => s.budget);
  const extracted = venue.lifecycle === "EXTRACTED";
  const buys = extracted && budget != null ? whatBudgetBuys(ranked, budget) : null;

  const intel =
    venue.lifecycle === "UNSCOUTED"
      ? "intel pending"
      : venue.lifecycle === "SCOUTED"
        ? "checking for specials…"
        : venue.lifecycle === "NO_DEAL_FOUND"
          ? "no posted specials — still cheap? tell the pipeline"
          : null;

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
      {extracted && cheapestDrink != null ? (
        <PriceTile price={cheapestDrink} state={status.state} />
      ) : extracted ? (
        <ScoreBadge score={score} state={status.state} />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-brass/25 bg-surface-2 text-[9px] uppercase tracking-wide text-muted">
          {venue.lifecycle === "NO_DEAL_FOUND" ? "—" : "?"}
        </div>
      )}
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
          {gameDay && (
            <span className="shrink-0 rounded bg-live-red/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-live-red">
              ⚾ Game day
            </span>
          )}
        </div>
        {extracted ? (
          <>
            <div className="mt-0.5 truncate text-[13px] text-brass">{headline}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <CountdownChip status={status} now={now} />
              {score > 0 && (
                <span className="tabular inline-flex items-center gap-0.5 rounded bg-neon-amber/10 px-1.5 py-0.5 text-[10px] font-semibold text-neon-amber/90">
                  <Zap className="h-2.5 w-2.5" fill="currentColor" />
                  {score}
                </span>
              )}
              <span className="truncate text-[11px] text-muted">
                {venue.neighborhood}
                {meters != null && ` · ${formatWalk(meters)}`}
              </span>
            </div>
          </>
        ) : (
          <div className="mt-1 flex items-center gap-2">
            <span className="truncate text-[12px] text-muted">{intel}</span>
            {meters != null && (
              <span className="shrink-0 text-[11px] text-muted">· {formatWalk(meters)}</span>
            )}
          </div>
        )}
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
