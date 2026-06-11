"use client";
import { useCallback } from "react";
import { useStore } from "@/store/useStore";

export const CHICAGO_CENTER = { lat: 41.886, lng: -87.632 };

/**
 * Geolocation is requested on first interaction (never on load). Denial or
 * timeout is non-fatal: the map falls back to the Loop center and a dismissible
 * banner explains it.
 */
export function useGeolocation() {
  const setUserLoc = useStore((s) => s.setUserLoc);
  const setGeoStatus = useStore((s) => s.setGeoStatus);
  const geoStatus = useStore((s) => s.geoStatus);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("granted");
      },
      () => {
        setUserLoc(null);
        setGeoStatus("denied");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  }, [setUserLoc, setGeoStatus]);

  return { request, geoStatus };
}
