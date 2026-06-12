"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import {
  Crosshair,
  Loader2,
  Heart as HeartIcon,
  Navigation2,
  Search,
  X,
  Clock,
  SlidersHorizontal,
  Wallet,
  Sparkles,
  Dices,
} from "lucide-react";
import { useVenues } from "@/lib/hooks/useVenues";
import { useEvents } from "@/lib/hooks/useEvents";
import { useTick } from "@/lib/hooks/useTick";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { useWindowed } from "@/lib/hooks/useWindowed";
import { useStore } from "@/store/useStore";
import { rankVenues } from "@/lib/engine/rank";
import { rankEvents } from "@/lib/engine/events";
import { applyFilters } from "@/lib/engine/filter";
import { parseQuery, applySearch } from "@/lib/engine/search";
import { planTonight } from "@/lib/engine/play";
import { liveStats, liveStatsLine } from "@/lib/engine/stats";
import { handshakeIndex } from "@/lib/engine/handshake";
import { gameDayVenueIds } from "@/lib/engine/gameday";
import { voice } from "@/lib/voice";
import { HQ } from "@/lib/hq";
import { RightNowStrip } from "./RightNowStrip";
import { HandshakeIndex } from "./HandshakeIndex";
import { WheelOfPoorDecisions } from "./WheelOfPoorDecisions";
import { Onboarding } from "./Onboarding";
import { FilterSheet } from "./FilterSheet";
import { DealRow } from "./DealRow";
import { EventRail } from "./EventRail";
import { EventDetail } from "./EventDetail";
import { BottomSheet, type SnapIndex } from "./BottomSheet";
import { GeoBanner } from "./GeoBanner";
import { DealDetail } from "./DealDetail";
import { BeelineMode } from "./BeelineMode";
import { RadarSweep } from "./RadarSweep";
import { TonightsPlay } from "./TonightsPlay";
import { TimeScrubber } from "./TimeScrubber";
import { cn } from "@/lib/utils";

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

type Tab = "all" | "saved";

/** One-tap example queries — the placeholder examples, made tappable. */
const EXAMPLE_QUERIES = [
  "beer under $5",
  "cocktails",
  "patio",
  "open late",
  "dives",
];

export function RadarApp() {
  const { venues, loading, error } = useVenues();
  const { events } = useEvents();
  const tick = useTick();
  const [scrub, setScrub] = useState<Date | null>(null);
  const [showScrubber, setShowScrubber] = useState(false);
  const now = scrub ?? tick;
  const { request, geoStatus } = useGeolocation();
  const userLoc = useStore((s) => s.userLoc);
  const filters = useStore((s) => s.filters);
  const budget = useStore((s) => s.budget);
  const setBudget = useStore((s) => s.setBudget);
  const favorites = useStore((s) => s.favorites);
  const selectedSlug = useStore((s) => s.selectedSlug);
  const select = useStore((s) => s.select);
  const anchor = useStore((s) => s.anchor);
  const setAnchor = useStore((s) => s.setAnchor);
  const showEvents = useStore((s) => s.showEvents);
  const selectedEventId = useStore((s) => s.selectedEventId);
  const selectEvent = useStore((s) => s.selectEvent);
  const anchorPoint =
    anchor === "gps" && userLoc ? userLoc : { lat: HQ.lat, lng: HQ.lng };

  const [snap, setSnap] = useState<SnapIndex>(1);
  const [tab, setTab] = useState<Tab>("all");
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [sweep, setSweep] = useState(0);
  const [showPlay, setShowPlay] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [query, setQuery] = useState("");
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fire the radar sweep once the deals first land, then again on each re-locate.
  useEffect(() => {
    if (!loading && venues.length > 0) setSweep((s) => s + 1);
  }, [loading, venues.length]);
  useEffect(() => {
    if (userLoc) setSweep((s) => s + 1);
  }, [userLoc]);

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
    () => rankVenues(venues, now, anchorPoint),
    [venues, now, anchorPoint.lat, anchorPoint.lng] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const filtered = useMemo(
    () => applyFilters(ranked, filters),
    [ranked, filters]
  );
  const searched = useMemo(
    () => applySearch(filtered, parseQuery(query)),
    [filtered, query]
  );
  const visible = useMemo(
    () =>
      tab === "saved"
        ? searched.filter((r) => favorites.includes(r.venue.id))
        : searched,
    [searched, tab, favorites]
  );
  const stats = useMemo(() => liveStats(ranked), [ranked]);
  const detailVenue = venues.find((v) => v.slug === detailSlug) ?? null;

  const rankedEvents = useMemo(() => rankEvents(events, now), [events, now]);
  // Map + rail focus on what you can act on tonight — far-future games stay off.
  const railEvents = showEvents
    ? rankedEvents.filter((e) => e.timing.state !== "UPCOMING")
    : [];
  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const play = useMemo(() => planTonight(ranked, now), [ranked, now]);
  const handshake = useMemo(() => handshakeIndex(ranked), [ranked]);
  const gameDayIds = useMemo(
    () => gameDayVenueIds(venues, events, now),
    [venues, events, now]
  );

  const { count: windowCount, sentinelRef } = useWindowed(visible.length);

  // Live-cluster cycle: tapping the "N live now" pill walks the camera through
  // every live venue in turn (reuses select → map flyTo + row scroll).
  const liveVenues = useMemo(
    () =>
      ranked.filter(
        (r) =>
          r.status.state === "LIVE" &&
          r.venue.lat != null &&
          r.venue.lng != null
      ),
    [ranked]
  );
  const cycleIdx = useRef(0);
  function cycleLive() {
    if (liveVenues.length === 0) return;
    const target = liveVenues[cycleIdx.current % liveVenues.length];
    cycleIdx.current += 1;
    handleMarkerSelect(target.venue.slug);
  }

  const beeline = useStore((s) => s.beeline);
  const setBeeline = useStore((s) => s.setBeeline);
  // Best target for BEELINE: nearest LIVE deal, else nearest opening-soon.
  const beelineTarget = useMemo(() => {
    const withCoords = ranked.filter(
      (r) => r.venue.lat != null && r.venue.lng != null && r.walkMin != null
    );
    const live = withCoords
      .filter((r) => r.status.state === "LIVE")
      .sort((a, b) => (a.walkMin ?? 0) - (b.walkMin ?? 0));
    if (live[0]) return live[0];
    return (
      withCoords
        .filter((r) => r.status.state === "STARTS_SOON")
        .sort((a, b) => (a.walkMin ?? 0) - (b.walkMin ?? 0))[0] ?? null
    );
  }, [ranked]);

  // Marker tap: highlight + center, surface the row.
  function handleMarkerSelect(slug: string) {
    select(slug);
    if (snap === 2) setSnap(1);
    requestAnimationFrame(() =>
      rowRefs.current[slug]?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
  }
  // Row tap: open the full detail.
  function handleRowSelect(slug: string) {
    select(slug);
    setDetailSlug(slug);
  }

  function cycleBudget() {
    setBudget(budget === 20 ? 40 : budget === 40 ? null : 20);
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <Onboarding />
      <MapView
        ranked={searched}
        selectedSlug={selectedSlug}
        onSelect={handleMarkerSelect}
        userLoc={userLoc}
        anchorPoint={anchorPoint}
        events={railEvents}
        selectedEventId={selectedEventId}
        onSelectEvent={selectEvent}
        gameDayIds={gameDayIds}
      />

      <RadarSweep trigger={sweep} />

      {/* Top bar — wordmark + status-aware truth + at most three labeled controls */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1100] flex items-start justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="pointer-events-auto">
          <h1 className="neon-amber neon-flicker font-display text-xl leading-none">
            LAST CALL
          </h1>
          {stats.liveNow > 0 ? (
            <button
              type="button"
              onClick={cycleLive}
              aria-label="Cycle the map through live deals"
              className="tabular mt-1 inline-flex items-center gap-1.5 rounded-full border border-live-red/40 bg-ink/80 px-2 py-0.5 text-[11px] text-live-red backdrop-blur active:scale-95"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live-red" />
              {liveStatsLine(stats)}
            </button>
          ) : (
            <p className="tabular mt-1 text-[11px] text-brass">
              {liveStatsLine(stats)}
            </p>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          <ControlButton
            label="Locate"
            onClick={request}
            active={anchor === "gps" && !!userLoc}
          >
            {geoStatus === "locating" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crosshair className="h-4 w-4" />
            )}
          </ControlButton>
          {/* Anchor toggle */}
          <div className="flex overflow-hidden rounded-full border border-brass/30 bg-surface/90 text-[11px] backdrop-blur">
            <button
              type="button"
              onClick={() => setAnchor("hq")}
              className={cn(
                "px-2.5 py-1.5 font-medium",
                anchor === "hq" ? "bg-neon-amber/20 text-neon-amber" : "text-muted"
              )}
            >
              Office
            </button>
            <button
              type="button"
              onClick={() => {
                if (!userLoc) request();
                setAnchor("gps");
              }}
              className={cn(
                "px-2.5 py-1.5 font-medium",
                anchor === "gps" && userLoc
                  ? "bg-neon-amber/20 text-neon-amber"
                  : "text-muted"
              )}
            >
              Me
            </button>
          </div>
          <ControlButton
            label="Time travel"
            onClick={() => setShowScrubber((v) => !v)}
            active={!!scrub}
          >
            <Clock className="h-4 w-4" />
          </ControlButton>
        </div>
      </header>

      {/* THE ANSWER — top live picks, before any control */}
      <RightNowStrip ranked={searched} now={now} onSelect={handleRowSelect} />

      <GeoBanner />

      {/* Time scrubber */}
      <AnimatePresence>
        {showScrubber && (
          <TimeScrubber
            value={scrub}
            onChange={setScrub}
            onClose={() => setShowScrubber(false)}
          />
        )}
      </AnimatePresence>

      {/* BEELINE floating action button */}
      {userLoc && beelineTarget && !beeline && !showScrubber && (
        <button
          type="button"
          onClick={() => setBeeline(true)}
          className="absolute right-4 z-[1100] flex items-center gap-2 rounded-full border border-neon-amber/60 bg-ink/90 px-4 py-2.5 font-display text-sm text-neon-amber shadow-[0_0_20px_rgba(255,181,46,0.35)] backdrop-blur active:scale-95"
          style={{ bottom: "calc(18dvh + 16px)" }}
        >
          <Navigation2 className="h-4 w-4" fill="currentColor" />
          BEELINE
        </button>
      )}

      {/* Bottom sheet */}
      <BottomSheet snap={snap} onSnap={setSnap}>
        <div className="sticky top-0 z-10 -mx-3 mb-1 bg-ink/95 pb-2 pt-1 backdrop-blur">
          {/* ONE compact control row: search · Filters · Budget */}
          <div className="flex items-center gap-2 px-4 pb-2">
            <div className="flex flex-1 items-center gap-2 rounded-coaster border border-brass/25 bg-surface px-3">
              <Search className="h-4 w-4 shrink-0 text-brass" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search the bar…"
                className="w-full bg-transparent py-2.5 text-[13px] text-cream placeholder:text-muted focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="shrink-0 text-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              aria-label="Filters"
              className={cn(
                "relative grid h-10 w-10 shrink-0 place-items-center rounded-coaster border",
                filters.length > 0
                  ? "border-neon-amber bg-neon-amber/15 text-neon-amber"
                  : "border-brass/25 bg-surface text-brass"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {filters.length > 0 && (
                <span className="tabular absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-neon-amber text-[9px] font-bold text-ink">
                  {filters.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={cycleBudget}
              aria-label="Cycle budget"
              className={cn(
                "tabular flex h-10 shrink-0 items-center gap-1 rounded-coaster border px-2.5 text-[12px] font-semibold",
                budget != null
                  ? "border-neon-amber bg-neon-amber/15 text-neon-amber"
                  : "border-brass/25 bg-surface text-brass"
              )}
            >
              <Wallet className="h-4 w-4" />
              {budget != null ? `$${budget}` : "Budget"}
            </button>
          </div>

          {/* Tappable example queries + the Wheel */}
          {!query && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
              <button
                type="button"
                onClick={() => setShowWheel(true)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-3 py-1 text-[12px] font-semibold text-neon-amber active:scale-95"
              >
                <Dices className="h-3.5 w-3.5" /> Spin
              </button>
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuery(q)}
                  className="shrink-0 rounded-full border border-brass/20 bg-surface px-3 py-1 text-[12px] text-muted active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between px-4 pt-1.5">
            <p className="font-display text-[13px] text-brass">
              {visible.length} spots · cheapest first
            </p>
            <div className="flex items-center gap-2">
              {play && play.stops.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setShowPlay(true)}
                  className="flex items-center gap-1 rounded-full border border-neon-amber/40 bg-neon-amber/10 px-2.5 py-1 text-[11px] font-semibold text-neon-amber"
                >
                  <Sparkles className="h-3 w-3" />~${play.totalDamage} run
                </button>
              )}
              <div className="flex rounded-full border border-brass/25 p-0.5 text-[12px]">
                <button
                  type="button"
                  onClick={() => setTab("all")}
                  className={cn(
                    "rounded-full px-3 py-1 font-medium transition-colors",
                    tab === "all" ? "bg-neon-amber/15 text-neon-amber" : "text-muted"
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTab("saved")}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors",
                    tab === "saved" ? "bg-live-red/15 text-live-red" : "text-muted"
                  )}
                >
                  <HeartIcon className="h-3 w-3" fill="currentColor" />
                  {favorites.length}
                </button>
              </div>
            </div>
          </div>
        </div>

        <HandshakeIndex handshake={handshake} onSelect={handleRowSelect} />

        {showEvents && railEvents.length > 0 && (
          <>
            <EventRail events={railEvents} onSelect={selectEvent} />
            <div className="brass-rule mx-4 my-2.5" />
          </>
        )}

        {loading && (
          <div className="grid place-items-center gap-2 px-8 py-16 text-center text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-[12px]">{voice.loading(now)}</span>
            <span className="mt-1 text-[11px] italic text-muted/70">
              {voice.lore(now)}
            </span>
          </div>
        )}
        {error && (
          <div className="px-4 py-12 text-center text-sm text-muted">
            {voice.error(now)}
          </div>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="px-6 py-16 text-center text-sm text-muted">
            {tab === "saved"
              ? voice.emptySaved(now)
              : filters.length > 0 || query
                ? voice.emptyFiltered(now)
                : voice.emptyNoLive(now)}
          </div>
        )}

        <div className="flex flex-col gap-1.5 pb-6">
          {visible.slice(0, windowCount).map((r) => (
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
                onSelect={handleRowSelect}
                gameDay={gameDayIds.has(r.venue.id)}
              />
            </div>
          ))}
          {windowCount < visible.length && (
            <div ref={sentinelRef} className="h-8" aria-hidden />
          )}
        </div>
      </BottomSheet>

      {/* Filters sheet */}
      <AnimatePresence>
        {showFilters && <FilterSheet onClose={() => setShowFilters(false)} />}
      </AnimatePresence>

      {/* Wheel of Poor Decisions */}
      <AnimatePresence>
        {showWheel && (
          <WheelOfPoorDecisions
            ranked={ranked}
            onClose={() => setShowWheel(false)}
            onSelect={(slug) => {
              setShowWheel(false);
              handleMarkerSelect(slug);
            }}
          />
        )}
      </AnimatePresence>

      {/* Detail overlay */}
      <AnimatePresence>
        {detailVenue && (
          <DealDetail
            key={detailVenue.id}
            venue={detailVenue}
            now={now}
            onClose={() => setDetailSlug(null)}
          />
        )}
      </AnimatePresence>

      {/* Event overlay — pre-game drinks for a Chicago happening */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetail
            key={selectedEvent.id}
            event={selectedEvent}
            ranked={ranked}
            now={now}
            onClose={() => selectEvent(null)}
            onSelectVenue={(slug) => {
              selectEvent(null);
              handleRowSelect(slug);
            }}
          />
        )}
      </AnimatePresence>

      {/* Tonight's Play overlay */}
      <AnimatePresence>
        {showPlay && play && (
          <TonightsPlay play={play} onClose={() => setShowPlay(false)} />
        )}
      </AnimatePresence>

      {/* BEELINE MODE overlay */}
      <AnimatePresence>
        {beeline && beelineTarget && userLoc && (
          <BeelineMode
            target={beelineTarget}
            initialUser={userLoc}
            now={now}
            onClose={() => setBeeline(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/** A labeled top-bar control — no more mystery meat. */
function ControlButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border backdrop-blur active:scale-95",
        active
          ? "border-neon-amber bg-neon-amber/20 text-neon-amber"
          : "border-brass/30 bg-surface/90 text-brass"
      )}
    >
      {children}
    </button>
  );
}
