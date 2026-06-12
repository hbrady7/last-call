"use client";
import { motion } from "framer-motion";
import {
  X,
  Navigation,
  ExternalLink,
  Clock,
  MapPin,
  Beer,
  Ticket,
} from "lucide-react";
import type { CityEvent } from "@/lib/types";
import type { RankedVenue } from "@/lib/engine/rank";
import {
  eventTiming,
  pregameDeals,
  formatEventTime,
} from "@/lib/engine/events";
import { formatWalk } from "@/lib/engine/distance";
import { EVENT_META, eventPriceLabel } from "./eventMeta";
import { cn } from "@/lib/utils";

export function EventDetail({
  event,
  ranked,
  now,
  onClose,
  onSelectVenue,
}: {
  event: CityEvent;
  ranked: RankedVenue[];
  now: Date;
  onClose: () => void;
  onSelectVenue: (slug: string) => void;
}) {
  const timing = eventTiming(event, now);
  const pregame = pregameDeals(event, ranked, 5);
  const Icon = EVENT_META[event.category].icon;
  const live = timing.state === "LIVE_NOW";
  const directions = `https://maps.google.com/?daddr=${event.lat},${event.lng}`;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 360, damping: 38 }}
      className="fixed inset-0 z-[2000] flex flex-col bg-ink/98 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-event/20 px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-3">
        <span
          className={cn(
            "grid h-14 w-14 shrink-0 place-items-center rounded-full border",
            live
              ? "border-event/70 bg-event/15 text-event neon-cyan"
              : "border-event/40 bg-event/10 text-event"
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl leading-tight text-cream">
            {event.name}
          </h2>
          <p className="mt-0.5 truncate text-[12px] text-event/90">
            {event.venueName}
            {event.neighborhood && ` · ${event.neighborhood}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={cn(
                "tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                live ? "bg-event/20 text-event" : "bg-event/10 text-event/90"
              )}
            >
              <Clock className="h-3 w-3" />
              {live
                ? timing.endsInMin != null && timing.endsInMin < 600
                  ? `On now · ${timing.endsInMin}m left`
                  : "Happening now"
                : timing.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 font-semibold text-brass">
              <Ticket className="h-3 w-3" />
              {eventPriceLabel(event.free, event.priceFrom)}
            </span>
            {event.recurring && (
              <span className="text-muted">{event.recurring}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-cream"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-4">
        <p className="text-[14px] leading-relaxed text-cream/90">{event.blurb}</p>

        <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
          <MapPin className="h-3.5 w-3.5 text-event/70" />
          {event.venueName} · doors {formatEventTime(timing.start)}
        </div>

        {/* Pre-game: the seam — cheapest pours near this event */}
        <section className="mt-6">
          <h3 className="flex items-center gap-1.5 font-display text-[13px] uppercase tracking-wide text-neon-amber">
            <Beer className="h-4 w-4" />
            Pre-game nearby
          </h3>
          <p className="mt-0.5 text-[12px] text-muted">
            Cheapest pours to hit before {event.name.split(" ").slice(0, 3).join(" ")}.
          </p>

          {pregame.length === 0 ? (
            <p className="mt-3 rounded-coaster bg-surface px-3 py-4 text-center text-[12px] text-muted">
              No tracked deals near this one yet — the pipeline&apos;s still
              drinking through that neighborhood.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {pregame.map(({ ranked: r, meters, walkMin }) => (
                <li key={r.venue.id}>
                  <button
                    type="button"
                    onClick={() => onSelectVenue(r.venue.slug)}
                    className="flex w-full items-center gap-3 rounded-coaster border border-brass/15 bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-2 active:scale-[0.99]"
                  >
                    <span className="tabular grid h-12 w-12 shrink-0 flex-col place-items-center rounded-full border border-neon-amber/40 bg-neon-amber/10 leading-none text-neon-amber">
                      <span className="text-[15px] font-semibold">
                        ${r.cheapestDrink}
                      </span>
                      <span className="mt-0.5 text-[8px] uppercase tracking-wide text-neon-amber/70">
                        pour
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-[14px] text-cream">
                        {r.venue.name}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-brass">
                        {r.headline}
                      </div>
                      <div className="tabular mt-0.5 text-[11px] text-muted">
                        {walkMin <= 18
                          ? formatWalk(meters)
                          : `${formatWalk(meters)} · worth the cab`}
                        {" · "}
                        {r.venue.neighborhood}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {event.url && (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1 text-[12px] text-event underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Event details &amp; tickets
          </a>
        )}
      </div>

      {/* Directions CTA */}
      <div className="border-t border-event/20 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-coaster bg-event py-3.5 font-display text-base text-ink active:scale-[0.98]"
        >
          <Navigation className="h-5 w-5" /> Directions to {event.venueName}
        </a>
      </div>
    </motion.div>
  );
}
