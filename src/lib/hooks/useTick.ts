"use client";
import { useEffect, useState } from "react";

/**
 * One shared 30s heartbeat for every countdown on screen. A single interval
 * drives all subscribers so 50 ticking chips don't spin up 50 timers.
 */
const subscribers = new Set<(d: Date) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function ensureTimer() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => {
    const now = new Date();
    subscribers.forEach((fn) => fn(now));
  }, 30_000);
}

export function useTick(): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const fn = (d: Date) => setNow(d);
    subscribers.add(fn);
    ensureTimer();
    // sync immediately so a freshly-mounted component isn't up to 30s stale
    setNow(new Date());
    return () => {
      subscribers.delete(fn);
      if (subscribers.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return now;
}
