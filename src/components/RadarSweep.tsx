"use client";
import { useEffect, useState } from "react";

/**
 * One orchestrated radar moment: a neon arm sweeps a full rotation from the
 * center while two rings ping outward, then it removes itself and the map goes
 * calm. Skipped entirely under reduced-motion.
 */
export function RadarSweep({ trigger }: { trigger: number }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return; // honor reduced motion — no sweep
    }
    setActive(true);
    const t = setTimeout(() => setActive(false), 1700);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[900] overflow-hidden">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="radar-arm" />
        <span className="radar-ring" />
        <span className="radar-ring radar-ring--delayed" />
      </div>
    </div>
  );
}
