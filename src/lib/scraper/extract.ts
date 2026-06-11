import Anthropic from "@anthropic-ai/sdk";
import { ExtractionSchema, type Extraction } from "../types";

const MODEL = "claude-haiku-4-5";

const SYSTEM = `You extract happy-hour and drink-deal data from restaurant/bar web page text for a Chicago deals app. You are a strict, literal extractor — not a guesser.

ANTI-HALLUCINATION RULES (absolute):
- Only include items whose price is EXPLICITLY printed on the page. If a price is not written, do not include that item.
- NEVER infer, estimate, or round a price or a time. No "usually", no "typically", no training-data knowledge.
- Use ONLY the text provided. If the page does not clearly describe a happy hour or recurring drink special, return found:false.
- Times must be copied from the page. If days or times are ambiguous, omit them (null) rather than guessing.
- Maximum 20 items. Categorize each as one of: beer, wine, cocktail, shot, food.
- days uses integers 0=Sunday .. 6=Saturday. startTime/endTime are 24h "HH:mm" or null.
- confidence reflects how clearly the page states the deal (1.0 = explicit table/list; <0.6 = vague).`;

const TOOL = {
  name: "record_deals",
  description:
    "Record the happy-hour / drink deals explicitly found on the page. Call exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      found: { type: "boolean" },
      deals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["happy_hour", "all_day"] },
            days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
            startTime: { type: ["string", "null"] },
            endTime: { type: ["string", "null"] },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  price: { type: ["number", "null"] },
                  category: {
                    type: "string",
                    enum: ["beer", "wine", "cocktail", "shot", "food"],
                  },
                },
                required: ["label", "price", "category"],
              },
            },
            finePrint: { type: ["string", "null"] },
          },
          required: ["kind", "days", "startTime", "endTime", "items", "finePrint"],
        },
      },
      confidence: { type: "number" },
    },
    required: ["found", "deals", "confidence"],
  },
};

export interface ExtractOutcome {
  status: "ok" | "no_deal_found" | "low_confidence" | "fetch_error";
  extraction: Extraction | null;
  note?: string;
}

/** Run the Anthropic extractor on page text. No API key → loud no-op. */
export async function extractDeals(
  venueName: string,
  pageText: string
): Promise<ExtractOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.warn(
      "[scraper] ANTHROPIC_API_KEY is not set — extraction skipped (no-op). Set it to enable the AI pipeline."
    );
    return { status: "fetch_error", extraction: null, note: "no_api_key" };
  }

  const client = new Anthropic({ apiKey });
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_deals" },
      messages: [
        {
          role: "user",
          content: `Venue: ${venueName}\n\nPage text:\n"""\n${pageText}\n"""\n\nExtract only explicitly-priced deals. If none, found:false.`,
        },
      ],
    });

    const toolBlock = msg.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return { status: "no_deal_found", extraction: null, note: "no tool call" };
    }

    const parsed = ExtractionSchema.safeParse(toolBlock.input);
    if (!parsed.success) {
      return {
        status: "no_deal_found",
        extraction: null,
        note: `schema mismatch: ${parsed.error.issues[0]?.message ?? "invalid"}`,
      };
    }
    const ex = parsed.data;
    if (!ex.found || ex.deals.length === 0) {
      return { status: "no_deal_found", extraction: ex, note: "found:false" };
    }
    if (ex.confidence < 0.6) {
      return { status: "low_confidence", extraction: ex, note: `confidence ${ex.confidence}` };
    }
    return { status: "ok", extraction: ex };
  } catch (e) {
    const note = e instanceof Error ? e.message : "anthropic error";
    return { status: "fetch_error", extraction: null, note };
  }
}
