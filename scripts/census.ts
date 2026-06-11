/**
 * THE CENSUS — every licensed bar within 2 miles of HQ, no key required.
 * Merges two free public sources and writes data/census.json (committed).
 *   1. Chicago Business Licenses (Socrata, authoritative existence + class)
 *   2. OpenStreetMap Overpass (enrichment: website)
 * Re-runnable & idempotent. Usage: pnpm census
 */
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HQ, RADIUS_METERS } from "../src/lib/hq";

const UA = "LastCallBot/1.0 (+github.com/hbrady7/last-call)";
const SOCRATA = "https://data.cityofchicago.org/resource/uupf-x98q.json";
const OVERPASS = "https://overpass-api.de/api/interpreter";

function hav(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLa = r(bLat - aLat);
  const dLo = r(bLng - aLng);
  const h =
    Math.sin(dLa / 2) ** 2 +
    Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|ltd|co|corp|the)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/'([A-Z])/g, (_, c) => "'" + c.toLowerCase());
}

interface CensusVenue {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  lat: number;
  lng: number;
  class: "bar" | "restaurant-bar";
  lifecycle: "UNSCOUTED" | "SCOUTED";
  website: string | null;
  dealSourceUrl: string | null;
  tags: string[];
  cashOnly: boolean;
  distanceFromHqM: number;
}

async function fetchLicenses(): Promise<CensusVenue[]> {
  const where = `license_description in('Tavern','Late Hour','Consumption on Premises - Incidental Activity') AND within_circle(location, ${HQ.lat}, ${HQ.lng}, ${RADIUS_METERS})`;
  const url = new URL(SOCRATA);
  url.searchParams.set("$where", where);
  url.searchParams.set(
    "$select",
    "doing_business_as_name,address,neighborhood,latitude,longitude,license_description"
  );
  url.searchParams.set("$limit", "5000");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Socrata HTTP ${res.status}`);
  const rows: Array<Record<string, string>> = await res.json();

  const byKey = new Map<string, CensusVenue>();
  for (const row of rows) {
    const rawName = row.doing_business_as_name;
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    if (!rawName || !isFinite(lat) || !isFinite(lng)) continue;
    const name = titleCase(rawName.trim());
    const norm = normalizeName(name);
    if (!norm) continue;
    const key = `${norm}|${(row.address ?? "").slice(0, 6)}`;
    if (byKey.has(key)) continue;
    const desc = row.license_description;
    const klass: CensusVenue["class"] =
      desc === "Consumption on Premises - Incidental Activity"
        ? "restaurant-bar"
        : "bar";
    byKey.set(key, {
      id: `census-${slugify(name)}-${byKey.size}`,
      slug: `${slugify(name)}-${byKey.size}`,
      name,
      address: row.address ? titleCase(row.address.trim()) : null,
      neighborhood: row.neighborhood ? titleCase(row.neighborhood) : null,
      lat,
      lng,
      class: klass,
      lifecycle: "UNSCOUTED",
      website: null,
      dealSourceUrl: null,
      tags: [],
      cashOnly: false,
      distanceFromHqM: Math.round(hav(HQ.lat, HQ.lng, lat, lng)),
    });
  }
  return [...byKey.values()];
}

interface OsmEntry {
  name: string;
  lat: number;
  lng: number;
  website: string | null;
}

async function fetchOsm(): Promise<OsmEntry[]> {
  const q = `[out:json][timeout:25];(node["amenity"~"bar|pub|nightclub|biergarten"](around:${RADIUS_METERS},${HQ.lat},${HQ.lng});way["amenity"~"bar|pub|nightclub|biergarten"](around:${RADIUS_METERS},${HQ.lat},${HQ.lng}););out center tags;`;
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data: { elements: Array<Record<string, unknown>> } = await res.json();
  const out: OsmEntry[] = [];
  for (const el of data.elements) {
    const tags = (el.tags ?? {}) as Record<string, string>;
    const name = tags.name;
    if (!name) continue;
    const lat = (el.lat as number) ?? (el.center as { lat: number })?.lat;
    const lng = (el.lon as number) ?? (el.center as { lon: number })?.lon;
    if (!isFinite(lat) || !isFinite(lng)) continue;
    out.push({
      name,
      lat,
      lng,
      website: tags.website ?? tags["contact:website"] ?? null,
    });
  }
  return out;
}

async function main() {
  console.log(`Census within ${RADIUS_METERS}m of ${HQ.name}…`);

  // Skip names already in the verified seed (runtime merge handles it too).
  const seedPath = fileURLToPath(new URL("../data/seed.json", import.meta.url));
  const seed = JSON.parse(readFileSync(seedPath, "utf-8"));
  const seedNames = new Set<string>(
    seed.venues.map((v: { name: string }) => normalizeName(v.name))
  );

  let licenses: CensusVenue[] = [];
  try {
    licenses = await fetchLicenses();
    console.log(`  Socrata: ${licenses.length} unique licensed venues`);
  } catch (e) {
    console.error("  Socrata failed:", e);
  }

  let osm: OsmEntry[] = [];
  try {
    osm = await fetchOsm();
    console.log(`  OSM: ${osm.length} bar/pub/nightclub entries`);
  } catch (e) {
    console.error("  OSM failed (continuing without websites):", e);
  }

  // Enrich licenses with OSM websites by name + proximity.
  let enriched = 0;
  for (const v of licenses) {
    const match = osm.find(
      (o) =>
        o.website &&
        (normalizeName(o.name) === normalizeName(v.name) ||
          (hav(o.lat, o.lng, v.lat, v.lng) < 80 &&
            normalizeName(o.name).slice(0, 4) === normalizeName(v.name).slice(0, 4)))
    );
    if (match?.website) {
      v.website = match.website;
      v.lifecycle = "SCOUTED";
      enriched++;
    }
  }

  // Append OSM-only bars (have a website, no license match) for broader coverage.
  const licNames = new Set(licenses.map((v) => normalizeName(v.name)));
  let osmOnly = 0;
  for (const o of osm) {
    const norm = normalizeName(o.name);
    if (!norm || licNames.has(norm) || seedNames.has(norm)) continue;
    const near = licenses.some(
      (v) => hav(o.lat, o.lng, v.lat, v.lng) < 60
    );
    if (near) continue;
    licNames.add(norm);
    licenses.push({
      id: `census-osm-${slugify(o.name)}-${osmOnly}`,
      slug: `${slugify(o.name)}-osm-${osmOnly}`,
      name: o.name,
      address: null,
      neighborhood: null,
      lat: o.lat,
      lng: o.lng,
      class: "bar",
      lifecycle: o.website ? "SCOUTED" : "UNSCOUTED",
      website: o.website,
      dealSourceUrl: null,
      tags: [],
      cashOnly: false,
      distanceFromHqM: Math.round(hav(HQ.lat, HQ.lng, o.lat, o.lng)),
    });
    osmOnly++;
  }

  const venues = licenses
    .filter((v) => !seedNames.has(normalizeName(v.name)))
    .sort((a, b) => a.distanceFromHqM - b.distanceFromHqM);

  const outPath = fileURLToPath(new URL("../data/census.json", import.meta.url));
  writeFileSync(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), venues }, null, 2) + "\n"
  );

  console.log(
    `✓ Census: ${venues.length} venues (${enriched} enriched w/ website, ${osmOnly} OSM-only added) → data/census.json`
  );
}

main().catch((e) => {
  console.error("Census failed:", e);
  process.exit(1);
});
