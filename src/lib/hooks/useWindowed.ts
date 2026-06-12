"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lightweight list windowing: render `step` rows, grow as a sentinel scrolls
 * into view. Keeps the DOM small with ~1,000 deals so the sheet stays at 60fps
 * without pulling in a virtualization dependency. Resets when `total` changes
 * (e.g. a new filter narrows the set).
 */
export function useWindowed(total: number, step = 30) {
  const [count, setCount] = useState(step);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCount(Math.min(step, total));
  }, [total, step]);

  const bump = useCallback(() => {
    setCount((c) => Math.min(c + step, total));
  }, [step, total]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || count >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) bump();
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [bump, count, total]);

  return { count, sentinelRef };
}
