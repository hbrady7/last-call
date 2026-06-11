"use client";
import { motion } from "framer-motion";
import { Clock, X } from "lucide-react";
import { formatMinuteOfDay, DAY_LABELS } from "@/lib/engine/time";
import { cn } from "@/lib/utils";

const MIN_START = 11 * 60; // 11:00
const MIN_END = 26 * 60; // 02:00 next day
const STEP = 30;

/**
 * Drag through the night (11 AM → 2 AM) on any weekday and the whole map
 * relights — pure status-machine, no data fetch. Built on the same engine that
 * powers the live view.
 */
export function TimeScrubber({
  value,
  onChange,
  onClose,
}: {
  /** scrubbed Date, or null for live. */
  value: Date | null;
  onChange: (d: Date | null) => void;
  onClose: () => void;
}) {
  const base = value ?? new Date();
  const minuteOfDay = base.getHours() * 60 + base.getMinutes();
  // Map an after-midnight time (0–2 AM) onto the high end of the slider.
  const sliderVal = minuteOfDay <= 120 ? minuteOfDay + 1440 : minuteOfDay;

  function setMinute(total: number) {
    const d = new Date(base);
    const m = total % 1440;
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    onChange(d);
  }

  function setWeekday(targetDow: number) {
    const d = new Date(base);
    d.setDate(d.getDate() + ((targetDow - d.getDay() + 7) % 7));
    onChange(d);
  }

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      className="pointer-events-auto absolute inset-x-3 z-[1200] rounded-coaster border border-brass/30 bg-ink/95 p-3 shadow-[0_-6px_24px_rgba(0,0,0,0.5)] backdrop-blur"
      style={{ bottom: "calc(18dvh + 16px)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-display text-sm text-neon-amber">
          <Clock className="h-4 w-4" />
          {value
            ? `${DAY_LABELS[base.getDay()]} ${formatMinuteOfDay(minuteOfDay)}`
            : "Live"}
        </span>
        <div className="flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-full bg-live-red/15 px-2.5 py-1 text-[11px] font-semibold text-live-red"
            >
              Back to live
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close scrubber" className="text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <input
        type="range"
        min={MIN_START}
        max={MIN_END}
        step={STEP}
        value={sliderVal}
        onChange={(e) => setMinute(Number(e.target.value))}
        className="w-full accent-[var(--color-neon-amber)]"
        aria-label="Scrub time of night"
      />
      <div className="tabular mt-0.5 flex justify-between text-[10px] text-muted">
        <span>11 AM</span>
        <span>6 PM</span>
        <span>2 AM</span>
      </div>

      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
        {DAY_LABELS.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setWeekday(i)}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-[11px]",
              (value ?? base).getDay() === i && value
                ? "border-neon-amber bg-neon-amber/15 text-neon-amber"
                : "border-brass/25 text-brass"
            )}
          >
            {d}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
