"use client";
import { motion } from "framer-motion";
import {
  X,
  Navigation,
  Banknote,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type { VenueWithDeals, Deal } from "@/lib/types";
import { getDealStatus } from "@/lib/engine/status";
import { scoreDeal } from "@/lib/engine/score";
import { formatWalk, haversineMeters } from "@/lib/engine/distance";
import { DAY_LABELS, formatMinuteOfDay, parseHHmm } from "@/lib/engine/time";
import { useStore } from "@/store/useStore";
import { ScoreBadge } from "./ScoreBadge";
import { CountdownChip } from "./CountdownChip";
import { Heart } from "./Heart";
import { cn } from "@/lib/utils";

function scheduleText(deal: Deal): string {
  if (deal.kind === "all_day") return "All day · 11 AM–2 AM";
  if (deal.startTime == null || deal.endTime == null) return "—";
  return `${formatMinuteOfDay(parseHHmm(deal.startTime))} – ${formatMinuteOfDay(
    parseHHmm(deal.endTime)
  )}`;
}

function DayGrid({ days }: { days: number[] }) {
  return (
    <div className="mt-2 flex gap-1">
      {DAY_LABELS.map((d, i) => (
        <span
          key={i}
          className={cn(
            "tabular grid h-7 flex-1 place-items-center rounded text-[10px] font-semibold",
            days.includes(i)
              ? "bg-neon-amber/20 text-neon-amber"
              : "bg-surface-2 text-muted/50"
          )}
        >
          {d[0]}
        </span>
      ))}
    </div>
  );
}

export function DealDetail({
  venue,
  now,
  onClose,
}: {
  venue: VenueWithDeals;
  now: Date;
  onClose: () => void;
}) {
  const userLoc = useStore((s) => s.userLoc);
  const meters =
    userLoc && venue.lat != null && venue.lng != null
      ? haversineMeters(userLoc.lat, userLoc.lng, venue.lat, venue.lng)
      : null;

  const directions =
    venue.lat != null && venue.lng != null
      ? `https://maps.google.com/?daddr=${venue.lat},${venue.lng}`
      : null;

  // headline status across deals
  const statuses = venue.deals.map((d) => ({ deal: d, status: getDealStatus(d, now) }));
  const headline =
    statuses.find((s) => s.status.state === "LIVE") ?? statuses[0] ?? null;
  const topScore = venue.deals.length ? Math.max(...venue.deals.map(scoreDeal)) : 0;

  const lastVerified = venue.deals.length
    ? new Date(
        Math.max(...venue.deals.map((d) => new Date(d.lastVerified).getTime()))
      )
    : null;
  const ageDays = lastVerified
    ? (now.getTime() - lastVerified.getTime()) / 86_400_000
    : 0;
  const lowConfidence = venue.deals.some((d) => d.confidence < 0.6);
  const stale = ageDays > 45 || lowConfidence;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 360, damping: 38 }}
      className="fixed inset-0 z-[2000] flex flex-col bg-ink/98 backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-brass/20 px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-3">
        {headline && (
          <ScoreBadge score={topScore} state={headline.status.state} size="lg" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl text-cream">
            {venue.name}
          </h2>
          <p className="mt-0.5 text-[12px] text-brass">
            {venue.neighborhood}
            {venue.address && ` · ${venue.address}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {headline && <CountdownChip status={headline.status} now={now} />}
            {meters != null && (
              <span className="text-[11px] text-muted">{formatWalk(meters)}</span>
            )}
            {venue.cashOnly && (
              <span className="inline-flex items-center gap-1 rounded bg-brass/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brass">
                <Banknote className="h-3 w-3" /> Cash only
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Heart venueId={venue.id} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-cream"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-4">
        {venue.deals.map((deal) => (
          <section key={deal.id} className="mb-5">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-neon-amber">
              <Clock className="h-3.5 w-3.5" />
              {deal.kind === "all_day" ? "Always cheap" : "Happy hour"}
              <span className="font-normal text-brass">· {scheduleText(deal)}</span>
            </div>
            <DayGrid days={deal.days.length ? deal.days : [0, 1, 2, 3, 4, 5, 6]} />

            <ul className="mt-3 divide-y divide-brass/10 rounded-coaster bg-surface">
              {deal.items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5"
                >
                  <span className="text-[14px] text-cream">{item.label}</span>
                  <span className="tabular text-[14px] font-semibold text-neon-amber">
                    {item.price != null ? `$${item.price}` : "—"}
                  </span>
                </li>
              ))}
            </ul>

            {deal.finePrint && (
              <p className="mt-2 text-[12px] italic text-muted">{deal.finePrint}</p>
            )}
            {deal.sourceUrl && (
              <a
                href={deal.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-brass underline"
              >
                <ExternalLink className="h-3 w-3" /> source
              </a>
            )}
          </section>
        ))}

        {/* Verification status */}
        {lastVerified && (
          <div
            className={cn(
              "mb-4 flex items-center gap-2 rounded-coaster px-3 py-2 text-[12px]",
              stale
                ? "bg-neon-amber/10 text-neon-amber"
                : "bg-surface text-muted"
            )}
          >
            {stale ? (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0 text-brass" />
            )}
            {stale
              ? "These prices are old — verify before you go."
              : `Verified ${lastVerified.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}`}
          </div>
        )}
      </div>

      {/* Directions CTA */}
      {directions && (
        <div className="border-t border-brass/20 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-coaster bg-neon-amber py-3.5 font-display text-base text-ink active:scale-[0.98]"
          >
            <Navigation className="h-5 w-5" /> Directions
          </a>
        </div>
      )}
    </motion.div>
  );
}
