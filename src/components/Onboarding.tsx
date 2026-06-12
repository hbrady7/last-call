"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ───────────────────────────── FIRST OPEN ─────────────────────────────────
   One cinematic 3-second neon flicker-on + radar sweep, then it gets out of the
   way forever. Skippable (tap anywhere). Never shown twice (localStorage).
   Reduced-motion → no animation, dismisses immediately. */

const SEEN_KEY = "last-call:onboarded";

export function Onboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* private mode — just skip */
    }
    if (seen) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    if (reduced) return; // honor the setting — no cinematic, straight to utility

    setShow(true);
    const t = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="onboard"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={() => setShow(false)}
          className="fixed inset-0 z-[3000] grid place-items-center overflow-hidden bg-ink"
        >
          {/* radar sweep behind the sign */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="radar-arm" />
            <div className="radar-ring" />
            <div className="radar-ring radar-ring--delayed" />
          </div>

          <div className="relative text-center">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.3, 1, 0.6, 1] }}
              transition={{ duration: 1.3, times: [0, 0.2, 0.32, 0.5, 0.62, 0.8] }}
              className="neon-amber font-display text-5xl leading-none tracking-tight"
            >
              LAST
              <br />
              CALL
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="mt-4 text-[12px] uppercase tracking-[0.3em] text-brass"
            >
              Cheapest pours · right now · Chicago
            </motion.p>
          </div>

          <button
            type="button"
            onClick={() => setShow(false)}
            className="absolute bottom-[calc(env(safe-area-inset-bottom)+28px)] left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-widest text-muted"
          >
            tap to skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
