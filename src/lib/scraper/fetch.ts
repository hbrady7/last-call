import * as cheerio from "cheerio";

const UA = "LastCallBot/1.0 (+github.com/hbrady7/last-call)";
const MAX_CHARS = 15_000;
const TIMEOUT_MS = 10_000;

export interface FetchResult {
  ok: boolean;
  text: string;
  status: "ok" | "fetch_error";
  note?: string;
}

/** Fetch a page (10s timeout, bot UA), strip to visible text, cap at 15k chars. */
export async function fetchPageText(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) {
      return { ok: false, text: "", status: "fetch_error", note: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, noscript, svg, iframe, head").remove();
    const text = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_CHARS);
    if (!text) {
      return { ok: false, text: "", status: "fetch_error", note: "empty body" };
    }
    return { ok: true, text, status: "ok" };
  } catch (e) {
    const note = e instanceof Error ? e.message : "fetch failed";
    return { ok: false, text: "", status: "fetch_error", note };
  } finally {
    clearTimeout(timer);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
