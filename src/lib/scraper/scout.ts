import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getRepo } from "../repo";

const MODEL = "claude-haiku-4-5";

const AGGREGATORS = [
  "yelp.",
  "google.",
  "facebook.",
  "fb.com",
  "instagram.",
  "opentable.",
  "timeout.",
  "tripadvisor.",
  "foursquare.",
  "eventbrite.",
  "untappd.",
  "doordash.",
  "grubhub.",
  "mapquest.",
  "chicago.eater",
  "thrillist.",
];

const ScoutSchema = z.object({
  found: z.boolean(),
  websiteUrl: z.string().nullable().optional(),
  dealSourceUrl: z.string().nullable().optional(),
  confidence: z.number().optional(),
});

function isAggregator(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return AGGREGATORS.some((a) => u.includes(a));
}

export interface ScoutReport {
  venueId: string;
  venueName: string;
  status: "ok" | "not_found" | "error";
  websiteUrl?: string | null;
  dealSourceUrl?: string | null;
  note?: string;
}

/**
 * Scout the N oldest UNSCOUTED venues: a web_search-backed Haiku call finds the
 * official site + specials page, rejecting aggregators. Advances lifecycle to
 * SCOUTED on success. Cap 25/run. No key → loud no-op.
 */
export async function runScout(limit = 25): Promise<ScoutReport[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const repo = getRepo();
  if (!apiKey || !apiKey.trim()) {
    console.warn("[scout] ANTHROPIC_API_KEY not set — scout skipped (no-op).");
    return [];
  }
  const client = new Anthropic({ apiKey });
  const venues = await repo.getUnscoutedVenues(limit);
  const reports: ScoutReport[] = [];

  for (const v of venues) {
    try {
      const result = await scoutOne(client, v.name, v.address);
      if (
        result.found &&
        !isAggregator(result.dealSourceUrl) &&
        (result.websiteUrl || result.dealSourceUrl)
      ) {
        await repo.setScoutResult(v.id, {
          website: result.websiteUrl ?? null,
          dealSourceUrl: isAggregator(result.dealSourceUrl)
            ? null
            : (result.dealSourceUrl ?? null),
          lifecycle: "SCOUTED",
        });
        await repo.logScrape({
          venueId: v.id,
          step: "scout",
          status: "ok",
          note: result.dealSourceUrl ?? result.websiteUrl ?? "",
        });
        reports.push({
          venueId: v.id,
          venueName: v.name,
          status: "ok",
          websiteUrl: result.websiteUrl,
          dealSourceUrl: result.dealSourceUrl,
        });
      } else {
        await repo.logScrape({
          venueId: v.id,
          step: "scout",
          status: "not_found",
        });
        reports.push({ venueId: v.id, venueName: v.name, status: "not_found" });
      }
    } catch (e) {
      const note = e instanceof Error ? e.message : "error";
      await repo.logScrape({ venueId: v.id, step: "scout", status: "error", note });
      reports.push({ venueId: v.id, venueName: v.name, status: "error", note });
    }
  }
  return reports;
}

async function scoutOne(
  client: Anthropic,
  name: string,
  address: string | null
): Promise<z.infer<typeof ScoutSchema>> {
  const prompt = `Find the OFFICIAL website and the happy-hour / drink-specials page URL for this Chicago bar/restaurant:\n\n"${name}"${address ? `, ${address}, Chicago` : ", Chicago"}\n\nUse web search. Only return the venue's own domain — NEVER an aggregator (Yelp, Google, Facebook, OpenTable, TimeOut, TripAdvisor, etc.). If you can't confidently find the official site, return found:false.\n\nReply with ONLY a JSON object, no other text:\n{"found": true|false, "websiteUrl": string|null, "dealSourceUrl": string|null, "confidence": 0..1}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: "user", content: prompt }];
  let final = "";
  for (let i = 0; i < 4; i++) {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0,
      tools: [{ type: "web_search_20260209", name: "web_search" } as never],
      messages,
    });
    const text = msg.content
      .filter((b) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => b.text as string)
      .join("\n");
    if (text) final = text;
    if (msg.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    break;
  }

  const match = final.match(/\{[\s\S]*\}/);
  if (!match) return { found: false };
  try {
    const parsed = ScoutSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data : { found: false };
  } catch {
    return { found: false };
  }
}
