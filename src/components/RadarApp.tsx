"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Crosshair, Loader2 } from "lucide-react";
import { useVenues } from "@/lib/hooks/useVenues";
import { useTick } from "@/lib/hooks/useTick";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { useStore } from "@/store/useStore";
import { rankVenues } from "@/lib/engine/rank";
import { applyFilters } from "@/lib/engine/filter";
import { FilterChips } from "./FilterChips";
import { DealRow } from "./DealRow";
import { BottomSheet, type SnapIndex } from "./BottomSheet";
import { GeoBanner } from "./GeoBanner";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-ink">
      <span className="neon-amber neon-flicker font-display text-2xl">
        LAST CALL
      </span>
    </div>
  ),
});

export function RadarApp() {
  const { venues, loading, error } = useVenues();
  const now = useTick();
  const { request, geoStatus } = useGeolocation();
  const userLoc = useStore((s) => s.userLoc);
  const filters = useStore((s) => s.filters);
  const selectedSlug = useStore((s) => s.selectedSlug);
  const select = useStore((s) => s.select);

  const [snap, setSnap] = useState<SnapIndex>(1);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Geolocation on FIRST interaction, never on load.
  useEffect(() => {
    if (geoStatus !== "idle") return;
    const handler = () => {
      request();
      window.removeEventListener("pointerdown", handler);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    return () => window.removeEventListener("pointerdown", handler);
  }, [geoStatus, request]);

  const ranked = useMemo(
    () => rankVenues(venues, now, userLoc),
    [venues, now, userLoc]
  );
  const filtered = useMemo(
    () => applyFilters(ranked, filters),
    [ranked, filters]
  );
  const liveCount = ranked.filter((r) => r.status.state === "LIVE").length;

  function handleSelect(slug: string) {
    select(slug);
    if (snap === 2) setSnap(1);
    requestAnimationFrame(() => {
      rowRefs.current[slug]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        ranked={filtered}
        selectedSlug={selectedSlug}
        onSelect={handleSelect}
        userLoc={userLoc}
      />

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div>
          <h1 className="neon-amber neon-flicker font-display text-2xl leading-none">
            LAST CALL
          </h1>
          <p className="tabular mt-1 text-[11px] text-brass">
            {liveCount > 0 ? (
              <span className="text-live-red">{liveCount} live now</span>
            ) : (
              "Chicago happy-hour radar"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={request}
          aria-label="Find deals near me"
          className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-brass/30 bg-surface/90 text-neon-amber backdrop-blur active:scale-95"
        >
          {geoStatus === "locating" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Crosshair className="h-5 w-5" />
          )}
        </button>
      </header>

      <GeoBanner />

      {/* Bottom sheet */}
      <BottomSheet snap={snap} onSnap={setSnap}>
        <div className="sticky top-0 z-10 -mx-3 mb-1 bg-ink/95 pb-2 pt-1 backdrop-blur">
          <div className="px-4 pb-2">
            <p className="font-display text-base text-cream">
              {filtered.length} {filtered.length === 1 ? "deal" : "deals"}
              {filters.length > 0 && (
                <span className="ml-2 text-[12px] font-normal text-muted">
                  filtered
                </span>
              )}
            </p>
          </div>
          <FilterChips />
        </div>

        {loading && (
          <div className="grid place-items-center py-16 text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {error && (
          <div className="px-4 py-12 text-center text-sm text-muted">
            Couldn&apos;t load deals. Pull to refresh.
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="px-6 py-16 text-center text-sm text-muted">
            No deals match these filters right now. Try clearing a chip.
          </div>
        )}

        <div className="flex flex-col gap-1.5 pb-6">
          {filtered.map((r) => (
            <div
              key={r.venue.id}
              ref={(el) => {
                rowRefs.current[r.venue.slug] = el;
              }}
            >
              <DealRow
                ranked={r}
                now={now}
                selected={r.venue.slug === selectedSlug}
                onSelect={handleSelect}
              />
            </div>
          ))}
        </div>
      </BottomSheet>
    </main>
  );
}
