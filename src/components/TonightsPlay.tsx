"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { X, Share2, Footprints, Wallet, MapPin } from "lucide-react";
import type { TonightsPlay as Play } from "@/lib/engine/play";

export function TonightsPlay({
  play,
  onClose,
}: {
  play: Play;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Tonight's Play", text: play.text });
      } else {
        await navigator.clipboard.writeText(play.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user cancelled share — no-op */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2500] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 36 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border-t border-brass/30 bg-ink px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)]"
      >
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-brass/40" />
        <div className="flex items-center justify-between">
          <h2 className="neon-amber font-display text-xl">Tonight&apos;s Play</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-[12px] text-brass">
          The optimal run for right now — windows &amp; walk times respected.
        </p>

        <ol className="mt-4 space-y-3">
          {play.stops.map((s, i) => (
            <li key={s.ranked.venue.id} className="flex gap-3">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neon-amber/15 font-display text-sm text-neon-amber">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[15px] text-cream">
                  {s.ranked.venue.name}
                </div>
                <div className="text-[13px] text-brass">
                  {s.pick ? `$${s.pick.price} ${s.pick.label}` : s.ranked.headline}
                </div>
                <div className="tabular mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                  <MapPin className="h-3 w-3" />
                  {s.arriveInMin <= 0 ? "you're basically here" : `arrive in ~${s.arriveInMin} min`}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex items-center gap-4 border-t border-brass/15 pt-3 text-[13px] text-cream">
          <span className="tabular inline-flex items-center gap-1.5">
            <Footprints className="h-4 w-4 text-brass" /> ~{play.totalWalkMin} min
          </span>
          <span className="tabular inline-flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-brass" /> ~${play.totalDamage} damage
          </span>
        </div>

        <button
          type="button"
          onClick={share}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-coaster bg-neon-amber py-3 font-display text-ink active:scale-[0.98]"
        >
          <Share2 className="h-5 w-5" />
          {copied ? "Copied to clipboard" : "Share the plan"}
        </button>
      </motion.div>
    </motion.div>
  );
}
