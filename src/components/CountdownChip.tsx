"use client";
import { cn } from "@/lib/utils";
import type { DealStatus } from "@/lib/engine/status";
import { chicagoNow, formatMinuteOfDay } from "@/lib/engine/time";

function dur(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function statusText(status: DealStatus, now: Date): string {
  switch (status.state) {
    case "LIVE":
      return status.endsInMin == null
        ? "LIVE now"
        : `ends in ${dur(status.endsInMin)}`;
    case "STARTS_SOON":
      return `starts in ${dur(status.startsInMin ?? 0)}`;
    case "LATER_TODAY": {
      const open = chicagoNow(now).minuteOfDay + (status.startsInMin ?? 0);
      return `opens ${formatMinuteOfDay(open)}`;
    }
    case "NOT_TODAY":
      return "closed today";
  }
}

export function CountdownChip({
  status,
  now,
  className,
}: {
  status: DealStatus;
  now: Date;
  className?: string;
}) {
  const live = status.state === "LIVE";
  const soon = status.state === "STARTS_SOON";
  const closing = live && status.endsInMin != null && status.endsInMin <= 15;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
        live && !closing && "bg-live-red/15 text-live-red",
        closing && "bg-live-red/25 text-live-red neon-red neon-flicker-fast",
        soon && "bg-neon-amber/15 text-neon-amber",
        !live && !soon && "bg-surface-2 text-muted",
        className
      )}
    >
      {live && (
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full bg-live-red",
            !closing && "marker-pulse"
          )}
        />
      )}
      {statusText(status, now)}
    </span>
  );
}
