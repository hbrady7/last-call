"use client";
import { useEffect, useState } from "react";
import type { VenueWithDeals } from "../types";

interface State {
  venues: VenueWithDeals[];
  loading: boolean;
  error: string | null;
}

/** Fetch the venue+deal payload once from /api/venues. */
export function useVenues(): State {
  const [state, setState] = useState<State>({
    venues: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    fetch("/api/venues")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        setState({ venues: data.venues ?? [], loading: false, error: null });
      })
      .catch((e) => {
        if (!alive) return;
        setState({
          venues: [],
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load",
        });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
