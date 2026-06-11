"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type FilterKey =
  | "live"
  | "beer"
  | "cocktails"
  | "food"
  | "dives"
  | "walk15"
  | "patio"
  | "hasDeals";

export type GeoStatus = "idle" | "locating" | "granted" | "denied";
export type Anchor = "hq" | "gps";

export interface VisitLog {
  venueId: string;
  ts: number;
  saved: number; // dollars dodged vs baseline
}

interface Store {
  // persisted
  favorites: string[];
  filters: FilterKey[];
  budget: number | null;
  visits: VisitLog[];
  // ephemeral
  selectedSlug: string | null;
  userLoc: { lat: number; lng: number } | null;
  geoStatus: GeoStatus;
  beeline: boolean;
  anchor: Anchor;

  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  toggleFilter: (key: FilterKey) => void;
  setBudget: (b: number | null) => void;
  logVisit: (v: VisitLog) => void;
  select: (slug: string | null) => void;
  setUserLoc: (loc: { lat: number; lng: number } | null) => void;
  setGeoStatus: (s: GeoStatus) => void;
  setBeeline: (b: boolean) => void;
  setAnchor: (a: Anchor) => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      favorites: [],
      filters: [],
      budget: null,
      visits: [],
      selectedSlug: null,
      userLoc: null,
      geoStatus: "idle",
      beeline: false,
      anchor: "hq",

      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((x) => x !== id)
            : [...s.favorites, id],
        })),
      isFavorite: (id) => get().favorites.includes(id),
      toggleFilter: (key) =>
        set((s) => ({
          filters: s.filters.includes(key)
            ? s.filters.filter((k) => k !== key)
            : [...s.filters, key],
        })),
      setBudget: (b) => set({ budget: b }),
      logVisit: (v) => set((s) => ({ visits: [...s.visits, v] })),
      select: (slug) => set({ selectedSlug: slug }),
      setUserLoc: (loc) => set({ userLoc: loc }),
      setGeoStatus: (s) => set({ geoStatus: s }),
      setBeeline: (b) => set({ beeline: b }),
      setAnchor: (a) => set({ anchor: a }),
    }),
    {
      name: "last-call",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        favorites: s.favorites,
        filters: s.filters,
        budget: s.budget,
        visits: s.visits,
        anchor: s.anchor,
      }),
    }
  )
);
