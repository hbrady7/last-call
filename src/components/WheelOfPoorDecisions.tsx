"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Dices, Navigation } from "lucide-react";
import type { RankedVenue } from "@/lib/engine/rank";
import { voice } from "@/lib/voice";

/* ──────────────────────── WHEEL OF POOR DECISIONS ─────────────────────────
   The artist formerly known as Malört Roulette. Shake or tap → a neon slot
   reel spins through open dives within a 20-minute walk, lands on one, and the
   voice system hands you a dare. Deterministic dare (day-seeded); the pick is
   index-driven, not Math.random (which is unavailable / would break tests). */

function eligibleDives(ranked: RankedVenue[]): RankedVenue[] {
  const dives = ranked.filter(
    (r) =>
      r.status.state === "LIVE" &&
      r.venue.lat != null &&
      r.venue.lng != null &&
      (r.walkMin == null || r.walkMin <= 20) &&
      (r.venue.tags.includes("dive") ||
        r.venue.tags.includes("dive-bar") ||
        (r.cheapestDrink != null && r.cheapestDrink <= 7))
  );
  // fall back to any live cheap pour if no tagged dives are open
  return dives.length > 0
    ? dives
    : ranked.filter(
        (r) =>
          r.status.state === "LIVE" &&
          r.venue.lat != null &&
          r.cheapestDrink != null
      );
}

export function WheelOfPoorDecisions({
  ranked,
  onClose,
  onSelect,
}: {
  ranked: RankedVenue[];
  onClose: () => void;
  onSelect: (slug: string) => void;
}) {
  const pool = eligibleDives(ranked);
  const [reel, setReel] = useState<string>(pool[0]?.venue.name ?? "—");
  const [landed, setLanded] = useState<RankedVenue | null>(null);
  const [spinning, setSpinning] = useState(false);
  const spinCount = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function spin() {
    if (pool.length === 0 || spinning) return;
    setSpinning(true);
    setLanded(null);
    let ticks = 0;
    const total = 18 + (spinCount.current % 6); // varies the landing slot
    let i = spinCount.current;
    timer.current = setInterval(() => {
      i += 1;
      setReel(pool[i % pool.length].venue.name);
      ticks += 1;
      if (ticks >= total) {
        if (timer.current) clearInterval(timer.current);
        const winner = pool[i % pool.length];
        setLanded(winner);
        setReel(winner.venue.name);
        setSpinning(false);
        spinCount.current = i + 1;
      }
    }, 80);
  }

  // shake-to-spin (devicemotion), one-handed
  useEffect(() => {
    function onMotion(e: DeviceMotionEvent) {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0);
      if (mag > 32) spin();
    }
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length, spinning]);

  const dare = landed ? voice.dare(new Date(), spinCount.current) : null;
  const directions = landed
    ? `https://www.google.com/maps/dir/?api=1&destination=${landed.venue.lat},${landed.venue.lng}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2200] flex flex-col items-center justify-center bg-ink/96 px-6 backdrop-blur-md"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+14px)] grid h-10 w-10 place-items-center rounded-full border border-brass/30 text-muted"
      >
        <X className="h-5 w-5" />
      </button>

      <h2 className="neon-amber neon-flicker text-center font-display text-2xl leading-tight">
        WHEEL OF
        <br />
        POOR DECISIONS
      </h2>

      {pool.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">
          {voice.emptyNoLive(new Date())}
        </p>
      ) : (
        <>
          <div className="mt-8 w-full max-w-sm overflow-hidden rounded-coaster border-2 border-neon-amber/50 bg-surface shadow-[0_0_30px_rgba(255,181,46,0.25)]">
            <div
              className={cnReel(spinning)}
              aria-live="polite"
            >
              {reel}
            </div>
          </div>

          {landed ? (
            <div className="mt-6 w-full max-w-sm text-center">
              <p className="text-[13px] uppercase tracking-[0.2em] text-brass">
                Tonight you ruin
              </p>
              <p className="mt-1 font-display text-xl text-cream">
                {landed.venue.name}
              </p>
              {landed.cheapestDrink != null && (
                <p className="tabular mt-0.5 text-[13px] text-neon-amber">
                  ${landed.cheapestDrink} pour
                  {landed.walkMin != null &&
                    ` · ${Math.max(1, Math.round(landed.walkMin))} min walk`}
                </p>
              )}
              {dare && (
                <p className="mt-3 rounded-coaster border border-live-red/30 bg-live-red/10 px-3 py-3 text-[13px] italic text-live-red">
                  {dare}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={spin}
                  className="flex flex-1 items-center justify-center gap-2 rounded-coaster border border-brass/30 py-3 font-display text-[14px] text-brass active:scale-[0.98]"
                >
                  <Dices className="h-4 w-4" /> Again
                </button>
                {directions && (
                  <a
                    href={directions}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onSelect(landed.venue.slug)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-coaster bg-neon-amber py-3 font-display text-[14px] text-ink active:scale-[0.98]"
                  >
                    <Navigation className="h-4 w-4" /> Send it
                  </a>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={spin}
              disabled={spinning}
              className="mt-8 flex items-center gap-2 rounded-full bg-neon-amber px-8 py-3.5 font-display text-lg text-ink active:scale-95 disabled:opacity-70"
            >
              <Dices className="h-5 w-5" />
              {spinning ? "Spinning…" : "Pull it"}
            </button>
          )}
          <p className="mt-5 text-center text-[11px] text-muted">
            or shake your phone · open dives within a 20-min walk
          </p>
        </>
      )}
    </motion.div>
  );
}

function cnReel(spinning: boolean): string {
  return [
    "tabular grid place-items-center px-4 py-7 text-center font-display text-lg",
    spinning ? "text-neon-amber blur-[1px]" : "text-cream",
  ].join(" ");
}
