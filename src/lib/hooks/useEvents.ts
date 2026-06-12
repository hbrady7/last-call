"use client";
import { useEffect, useState } from "react";
import type { CityEvent } from "../types";

interface State {
  events: CityEvent[];
  loading: boolean;
  error: string | null;
}

/** Fetch the Chicago events payload once from /api/events. */
export function useEvents(): State {
  const [state, setState] = useState<State>({
    events: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    fetch("/api/events")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!alive) return;
        setState({ events: data.events ?? [], loading: false, error: null });
      })
      .catch((e) => {
        if (!alive) return;
        setState({
          events: [],
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
