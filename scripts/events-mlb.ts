/* ─────────────────────────── pnpm events:mlb ──────────────────────────────
   Real, free, keyless event provenance. The MLB StatsAPI (statsapi.mlb.com)
   needs no key and returns the official schedule. We pull Cubs (team 112,
   Wrigley Field) + White Sox (145, Rate Field) HOME games and merge them into
   data/events.json as `verified: true` rows with a real source + fetchedAt.

   Curated music/festival rows are left untouched (still honestly labeled
   "Curated" in the app). Run on the cron or by hand:  pnpm events:mlb
*/
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { EventsFileSchema, type CityEvent } from "../src/lib/types";

const EVENTS_PATH = fileURLToPath(new URL("../data/events.json", import.meta.url));

const TEAMS = [
  {
    id: 112,
    name: "Cubs",
    venueName: "Wrigley Field",
    neighborhood: "Wrigleyville",
    lat: 41.9484,
    lng: -87.6553,
    url: "https://www.mlb.com/cubs/schedule",
  },
  {
    id: 145,
    name: "White Sox",
    venueName: "Rate Field",
    neighborhood: "Armour Square",
    lat: 41.83,
    lng: -87.6339,
    url: "https://www.mlb.com/whitesox/schedule",
  },
] as const;

interface ScheduleGame {
  gamePk: number;
  gameDate: string; // ISO UTC
  status?: { abstractGameState?: string };
  teams: {
    home: { team: { id: number; name: string } };
    away: { team: { id: number; name: string } };
  };
}

/** Convert a UTC ISO instant to a naive America/Chicago local ISO (no tz). */
function toChicagoNaive(utcIso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcIso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}`;
}

async function fetchTeam(team: (typeof TEAMS)[number], fetchedAt: string): Promise<CityEvent[]> {
  const start = fetchedAt.slice(0, 10);
  const end = `${new Date(fetchedAt).getFullYear()}-12-31`;
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${team.id}&startDate=${start}&endDate=${end}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB API ${res.status} for ${team.name}`);
  const data = (await res.json()) as { dates?: { games: ScheduleGame[] }[] };
  const out: CityEvent[] = [];
  for (const day of data.dates ?? []) {
    for (const g of day.games) {
      if (g.teams.home.team.id !== team.id) continue; // home games only
      const startLocal = toChicagoNaive(g.gameDate);
      const startMs = new Date(startLocal).getTime();
      const endLocal = new Date(startMs + 3 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19);
      out.push({
        id: `mlb-${g.gamePk}`,
        name: `${team.name} vs. ${g.teams.away.team.name.replace(/.* /, "")}`,
        category: "sports",
        venueName: team.venueName,
        neighborhood: team.neighborhood,
        lat: team.lat,
        lng: team.lng,
        start: startLocal,
        end: endLocal,
        recurring: null,
        priceFrom: null,
        free: false,
        url: team.url,
        blurb: `${team.name} home game at ${team.venueName}.`,
        tags: ["mlb", "baseball", "game-day", team.name.toLowerCase().replace(/\s/g, "")],
        source: "MLB StatsAPI (statsapi.mlb.com)",
        fetchedAt,
        verified: true,
      });
    }
  }
  return out;
}

async function main() {
  // fetchedAt is "now" at run time — the one place a wall clock is legitimate.
  const fetchedAt = new Date().toISOString();
  const existing = EventsFileSchema.parse(JSON.parse(await readFile(EVENTS_PATH, "utf8")));

  let fetched: CityEvent[] = [];
  try {
    for (const t of TEAMS) fetched = fetched.concat(await fetchTeam(t, fetchedAt));
  } catch (e) {
    console.error("MLB fetch failed (network?). Leaving events.json untouched.", e);
    process.exit(1);
  }

  // Drop any prior verified MLB rows, keep curated rows, add fresh verified games.
  const curated = existing.events.filter((e) => !e.id.startsWith("mlb-"));
  const merged = [...curated, ...fetched].sort((a, b) => a.start.localeCompare(b.start));

  await writeFile(
    EVENTS_PATH,
    JSON.stringify({ ...existing, generatedAt: fetchedAt, events: merged }, null, 2) + "\n"
  );
  console.log(
    `✓ ${fetched.length} verified MLB home games merged with ${curated.length} curated rows.`
  );
}

main();
