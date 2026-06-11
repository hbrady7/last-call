"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface OrientationEventiOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}
type PermFn = () => Promise<"granted" | "denied">;

/**
 * Device compass heading in degrees (0 = North), or null if unavailable.
 * iOS needs an explicit permission gesture; Android exposes it directly.
 */
export function useDeviceHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [supported, setSupported] = useState(true);
  const listening = useRef(false);

  const handle = useCallback((e: DeviceOrientationEvent) => {
    const evt = e as OrientationEventiOS;
    if (typeof evt.webkitCompassHeading === "number") {
      setHeading(evt.webkitCompassHeading); // already 0=N, clockwise
    } else if (typeof e.alpha === "number") {
      // alpha is counter-clockwise from East-ish; convert to compass heading.
      setHeading((360 - e.alpha) % 360);
    }
  }, []);

  const start = useCallback(async () => {
    if (typeof window === "undefined" || listening.current) return;
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: PermFn;
    };
    if (!window.DeviceOrientationEvent) {
      setSupported(false);
      return;
    }
    try {
      if (typeof DOE?.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res !== "granted") {
          setSupported(false);
          return;
        }
      }
    } catch {
      // permission flow failed; fall through and try listening anyway
    }
    const evtName =
      "ondeviceorientationabsolute" in window
        ? "deviceorientationabsolute"
        : "deviceorientation";
    window.addEventListener(evtName, handle as EventListener, true);
    listening.current = true;
  }, [handle]);

  useEffect(() => {
    return () => {
      if (listening.current) {
        window.removeEventListener("deviceorientationabsolute", handle as EventListener, true);
        window.removeEventListener("deviceorientation", handle as EventListener, true);
        listening.current = false;
      }
    };
  }, [handle]);

  return { heading, supported, start };
}
