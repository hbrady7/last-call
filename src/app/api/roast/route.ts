import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { VOICE_RULES, voice } from "@/lib/voice";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 80; // hard cap — a roast is two sentences, not an essay

/**
 * ROAST MY PLAN (key-optional). Sends the itinerary to Haiku for a two-sentence
 * roast of the user's CHOICES (never people). No key → a rotating canned roast
 * from the deterministic voice system. Batched into one capped call.
 */
export async function POST(req: Request) {
  let plan = "";
  let salt = 0;
  try {
    const body = await req.json();
    plan = String(body.plan ?? "").slice(0, 1200);
    salt = Number(body.salt ?? 0) || 0;
  } catch {
    /* empty */
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return NextResponse.json({
      roast: voice.cannedRoast(new Date(), salt),
      source: "canned",
    });
  }

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.8,
      system: VOICE_RULES,
      messages: [
        {
          role: "user",
          content: `Roast this bar-crawl plan in two sentences. Punch at the choices, the prices, the optimism — never at any person.\n\n${plan}`,
        },
      ],
    });
    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .trim();
    return NextResponse.json({
      roast: text || voice.cannedRoast(new Date(), salt),
      source: text ? "haiku" : "canned",
    });
  } catch {
    return NextResponse.json({
      roast: voice.cannedRoast(new Date(), salt),
      source: "canned",
    });
  }
}
