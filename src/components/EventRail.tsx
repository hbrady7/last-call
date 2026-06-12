"use client";
import { CalendarRange } from "lucide-react";
import type { RankedEvent } from "@/lib/engine/events";
import { EVENT_META, eventPriceLabel } from "./eventMeta";
import { cn } from "@/lib/utils";

/**
 * A horizontal "Tonight in Chicago" rail. Live events pulse cyan; the rest read
 * as quiet marquee cards. Tapping one opens its pre-game sheet — the seam where
 * the city's events meet the cheapest pours nearby.
 */
export function EventRail({
  events,
  onSelect,
}: {
  events: RankedEvent[];
  onSelect: (id: string) => void;
}) {
  if (events.length === 0) return null;
  return (
    <section className="pt-1">
      <div className="flex items-center justify-between px-4 pb-1.5">
        <h2 className="flex items-center gap-1.5 font-display text-[13px] uppercase tracking-wide text-event">
          <CalendarRange className="h-3.5 w-3.5" />
          Tonight in Chicago
        </h2>
        <span className="tabular text-[11px] text-muted">{events.length} on</span>
      </div>
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 pb-1">
        {events.map(({ event, timing }) => {
          const Icon = EVENT_META[event.category].icon;
          const live = timing.state === "LIVE_NOW";
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelect(event.id)}
              className={cn(
                "group relative flex w-[164px] shrink-0 flex-col gap-1.5 rounded-coaster border px-3 py-2.5 text-left transition-colors active:scale-[0.98]",
                live
                  ? "border-event/60 bg-event/10"
                  : "border-brass/20 bg-surface hover:bg-surface-2"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full border",
                    live
                      ? "border-event/50 bg-event/15 text-event"
                      : "border-brass/25 bg-surface-2 text-brass"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span
                  className={cn(
                    "tabular text-[10px] font-semibold uppercase tracking-wide",
                    live ? "neon-cyan" : "text-muted"
                  )}
                >
                  {live ? "● Live" : timing.label.split(" · ")[0]}
                </span>
              </div>
              <p className="line-clamp-2 font-display text-[13px] leading-tight text-cream">
                {event.name}
              </p>
              <div className="flex items-center justify-between text-[11px]">
                <span className="truncate text-muted">{event.neighborhood}</span>
                <span
                  className={cn(
                    "shrink-0 font-semibold",
                    event.free ? "text-event" : "text-brass"
                  )}
                >
                  {eventPriceLabel(event.free, event.priceFrom)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
