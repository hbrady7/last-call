"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";

export type SnapIndex = 0 | 1 | 2; // 0 = full, 1 = mid, 2 = peek

const VISIBLE = [0.92, 0.55, 0.18]; // fraction of viewport visible per snap

/**
 * A bottom sheet pinned to 92dvh tall, translated down so only the active snap
 * height shows. The grab handle drags; the body scrolls independently.
 */
export function BottomSheet({
  snap,
  onSnap,
  children,
}: {
  snap: SnapIndex;
  onSnap: (s: SnapIndex) => void;
  children: React.ReactNode;
}) {
  const [vh, setVh] = useState(0);
  const y = useMotionValue(0);
  const drag = useRef<{ startY: number; startVal: number } | null>(null);

  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // translateY for each snap: how far down to push the 92dvh panel.
  const offsets =
    vh > 0 ? VISIBLE.map((v) => (0.92 - v) * vh) : [0, 0, 0];

  useEffect(() => {
    if (vh > 0) {
      const controls = animate(y, offsets[snap], {
        type: "spring",
        stiffness: 380,
        damping: 38,
      });
      return controls.stop;
    }
    // offsets depends on vh; snap drives the target
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, vh]);

  function nearestSnap(val: number, velocity: number): SnapIndex {
    const projected = val + velocity * 0.12;
    let best: SnapIndex = snap;
    let bestDist = Infinity;
    offsets.forEach((o, i) => {
      const d = Math.abs(o - projected);
      if (d < bestDist) {
        bestDist = d;
        best = i as SnapIndex;
      }
    });
    return best;
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { startY: e.clientY, startVal: y.get() };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const next = drag.current.startVal + (e.clientY - drag.current.startY);
    const clamped = Math.max(0, Math.min(offsets[2], next));
    y.set(clamped);
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current) return;
    const dist = y.get() - drag.current.startVal;
    drag.current = null;
    // crude velocity proxy from the gesture distance
    const target = nearestSnap(y.get(), dist * 3);
    onSnap(target);
    void e;
  }

  return (
    <motion.div
      style={{ y, height: "92dvh" }}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-[1000] flex flex-col rounded-t-3xl border-t border-brass/25 bg-ink/95 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md"
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5 pb-1 active:cursor-grabbing"
        role="slider"
        aria-label="Drag to resize the deal list"
        aria-valuenow={snap}
        aria-valuemin={0}
        aria-valuemax={2}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") onSnap(Math.max(0, snap - 1) as SnapIndex);
          if (e.key === "ArrowDown") onSnap(Math.min(2, snap + 1) as SnapIndex);
        }}
      >
        <div className="h-1.5 w-11 rounded-full bg-brass/50" />
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-3 pb-[env(safe-area-inset-bottom)]">
        {children}
      </div>
    </motion.div>
  );
}
