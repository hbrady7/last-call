"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Shuffle,
  Share2,
  Bookmark,
  Footprints,
  Wallet,
  MapPin,
  Clock,
  Flame,
  Loader2,
} from "lucide-react";
import { useVenues } from "@/lib/hooks/useVenues";
import { useStore } from "@/store/useStore";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { planNight, itineraryText, type Itinerary } from "@/lib/engine/planner";
import { HQ } from "@/lib/hq";
import { formatMinuteOfDay, chicagoNow, DAY_LABELS } from "@/lib/engine/time";
import { cn } from "@/lib/utils";

const VIBES = [
  { key: "dives", label: "Dives" },
  { key: "cocktails", label: "Cocktails" },
  { key: "food", label: "Food" },
  { key: "patio", label: "Patio" },
  { key: "live-music", label: "Live music" },
];
const BUDGETS = [20, 40, 60];

function nextHalfHour(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + (30 - (d.getMinutes() % 30)));
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export function PlannerView() {
  const { venues } = useVenues();
  const userLoc = useStore((s) => s.userLoc);
  const { request } = useGeolocation();
  const savePlan = useStore((s) => s.savePlan);

  const [startMode, setStartMode] = useState<"office" | "gps">("office");
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState(nextHalfHour());
  const [stops, setStops] = useState(3);
  const [budget, setBudget] = useState<number | null>(40);
  const [maxWalk, setMaxWalk] = useState(15);
  const [vibes, setVibes] = useState<string[]>([]);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [noPlan, setNoPlan] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [roast, setRoast] = useState<string | null>(null);
  const [roasting, setRoasting] = useState(false);

  const dayChoices = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return {
        offset: i,
        label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : DAY_LABELS[d.getDay()],
      };
    });
  }, []);

  function startAtDate(): Date {
    const [h, m] = time.split(":").map((x) => parseInt(x, 10));
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d;
  }

  function build(exclude: string[] = []) {
    const start =
      startMode === "gps" && userLoc ? userLoc : { lat: HQ.lat, lng: HQ.lng };
    const plan = planNight(venues, {
      start,
      startAt: startAtDate(),
      stops,
      maxWalkMin: maxWalk,
      budget,
      vibes,
      exclude,
    });
    setItinerary(plan);
    setNoPlan(!plan);
    setSaved(false);
    setRoast(null);
  }

  async function roastPlan() {
    if (!itinerary || roasting) return;
    setRoasting(true);
    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: itineraryText(itinerary),
          salt: excluded.length,
        }),
      });
      const data = await res.json();
      setRoast(typeof data.roast === "string" ? data.roast : null);
    } catch {
      setRoast("The roast machine is too drunk to type. Try again.");
    } finally {
      setRoasting(false);
    }
  }

  function shuffle() {
    if (!itinerary) return;
    const newExcluded = [...excluded, itinerary.stops[0].venue.id];
    setExcluded(newExcluded);
    build(newExcluded);
  }

  function summonUrl(it: Itinerary): string {
    const first = it.stops[0];
    const t = formatMinuteOfDay(chicagoNow(first.arriveAt).minuteOfDay);
    const pick = first.pick ? `$${first.pick.price} ${first.pick.label}` : "the cheap stuff";
    const params = new URLSearchParams({
      t: "summon",
      headline: `WE RIDE AT ${t}`,
      sub: `${first.venue.name.toUpperCase()} · ${pick.toUpperCase()}`,
      footer: `${it.stops.length} STOPS · ~$${it.totalDamage} · DON'T BE LATE`,
    });
    return `${window.location.origin}/share?${params.toString()}`;
  }

  async function share() {
    if (!itinerary) return;
    const text = itineraryText(itinerary);
    const url = summonUrl(itinerary);
    try {
      if (navigator.share) await navigator.share({ title: "WE RIDE", text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
    } catch {
      /* cancelled */
    }
  }

  function save() {
    if (!itinerary) return;
    savePlan({
      id: `plan-${itinerary.stops.map((s) => s.venue.slug).join("-")}`,
      text: itineraryText(itinerary),
      createdAt: Date.now(),
    });
    setSaved(true);
  }

  function toggleVibe(v: string) {
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 pt-[calc(env(safe-area-inset-top)+16px)]">
      <header className="mb-5 flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back to map"
          className="grid h-10 w-10 place-items-center rounded-full border border-brass/30 text-cream"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="neon-amber font-display text-2xl leading-none">The Planner</h1>
          <p className="mt-1 text-[11px] text-brass">Build a bankable night out.</p>
        </div>
      </header>

      {/* Inputs */}
      <section className="space-y-4 rounded-coaster border border-brass/15 bg-surface p-4">
        <Field label="Start from">
          <Segmented
            options={[
              { key: "office", label: "Office" },
              { key: "gps", label: "My location" },
            ]}
            value={startMode}
            onChange={(v) => {
              if (v === "gps" && !userLoc) request();
              setStartMode(v as "office" | "gps");
            }}
          />
        </Field>

        <Field label="When">
          <div className="flex gap-2">
            <select
              value={dayOffset}
              onChange={(e) => setDayOffset(Number(e.target.value))}
              className="tabular flex-1 rounded-coaster border border-brass/25 bg-ink px-3 py-2 text-sm text-cream"
            >
              {dayChoices.map((d) => (
                <option key={d.offset} value={d.offset}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="tabular w-28 rounded-coaster border border-brass/25 bg-ink px-3 py-2 text-sm text-cream"
            />
          </div>
        </Field>

        <Field label={`Stops · ${stops}`}>
          <Segmented
            options={[2, 3, 4].map((n) => ({ key: String(n), label: String(n) }))}
            value={String(stops)}
            onChange={(v) => setStops(Number(v))}
          />
        </Field>

        <Field label={`Max walk per leg · ${maxWalk} min`}>
          <input
            type="range"
            min={5}
            max={30}
            step={5}
            value={maxWalk}
            onChange={(e) => setMaxWalk(Number(e.target.value))}
            className="w-full accent-[var(--color-neon-amber)]"
          />
        </Field>

        <Field label="Budget">
          <Segmented
            options={[
              ...BUDGETS.map((b) => ({ key: String(b), label: `$${b}` })),
              { key: "none", label: "No cap" },
            ]}
            value={budget == null ? "none" : String(budget)}
            onChange={(v) => setBudget(v === "none" ? null : Number(v))}
          />
        </Field>

        <Field label="Vibe">
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => toggleVibe(v.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px]",
                  vibes.includes(v.key)
                    ? "border-neon-amber bg-neon-amber/15 text-neon-amber"
                    : "border-brass/25 text-brass"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </Field>

        <button
          type="button"
          onClick={() => {
            setExcluded([]);
            build([]);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-coaster bg-neon-amber py-3 font-display text-ink active:scale-[0.98]"
        >
          <Sparkles className="h-5 w-5" /> Build my night
        </button>
      </section>

      {/* Itinerary */}
      {noPlan && (
        <p className="mt-6 rounded-coaster border border-brass/15 bg-surface p-4 text-center text-sm text-muted">
          No live run fits those constraints. Try an earlier time, more walk, or
          fewer filters — only EXTRACTED venues with posted deals can be planned.
        </p>
      )}

      {itinerary && (
        <section className="mt-6">
          <p className="mb-3 text-[13px] italic text-brass">{itinerary.intro}</p>
          <ol className="space-y-3">
            {itinerary.stops.map((s, i) => (
              <li
                key={s.venue.id}
                className="rounded-coaster border border-brass/15 bg-surface p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neon-amber/15 font-display text-sm text-neon-amber">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[15px] text-cream">
                      {s.venue.name}
                    </div>
                    <div className="text-[13px] text-brass">
                      order: {s.pick ? `$${s.pick.price} ${s.pick.label}` : "house pick"}
                    </div>
                    <div className="tabular mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatMinuteOfDay(chicagoNow(s.arriveAt).minuteOfDay)}–
                        {formatMinuteOfDay(chicagoNow(s.leaveAt).minuteOfDay)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Footprints className="h-3 w-3" />
                        {s.walkMin} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        steal {s.stealScore}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-3 flex items-center gap-4 text-[13px] text-cream">
            <span className="tabular inline-flex items-center gap-1.5">
              <Footprints className="h-4 w-4 text-brass" /> ~{itinerary.totalWalkMin} min
            </span>
            <span
              className={cn(
                "tabular inline-flex items-center gap-1.5",
                itinerary.withinBudget ? "text-cream" : "text-live-red"
              )}
            >
              <Wallet className="h-4 w-4 text-brass" /> ~${itinerary.totalDamage}
              {itinerary.budget != null && ` / $${itinerary.budget}`}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <ActionBtn onClick={shuffle} icon={<Shuffle className="h-4 w-4" />} label="Shuffle" />
            <ActionBtn onClick={share} icon={<Share2 className="h-4 w-4" />} label="Share" />
            <ActionBtn
              onClick={save}
              icon={<Bookmark className="h-4 w-4" />}
              label={saved ? "Saved" : "Save"}
              active={saved}
            />
          </div>

          {/* ROAST MY PLAN — the app talks back */}
          <button
            type="button"
            onClick={roastPlan}
            disabled={roasting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-coaster border border-live-red/40 bg-live-red/10 py-2.5 text-[13px] font-semibold text-live-red active:scale-[0.99] disabled:opacity-60"
          >
            {roasting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Flame className="h-4 w-4" />
            )}
            {roast ? "Roast me again" : "Roast my plan"}
          </button>
          {roast && (
            <p className="mt-2 rounded-coaster border border-live-red/20 bg-surface px-3 py-3 text-[13px] italic leading-relaxed text-cream">
              “{roast}”
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-full border border-brass/25">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "flex-1 px-2 py-1.5 text-[12px] font-medium transition-colors",
            value === o.key ? "bg-neon-amber/15 text-neon-amber" : "text-brass"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ActionBtn({
  onClick,
  icon,
  label,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-coaster border py-2.5 text-[12px] font-medium",
        active
          ? "border-neon-amber bg-neon-amber/15 text-neon-amber"
          : "border-brass/30 text-brass"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
