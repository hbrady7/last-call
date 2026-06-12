import { ImageResponse } from "next/og";

export const runtime = "edge";

/* ───────────────────────────── GROUP CHAT BAIT ────────────────────────────
   Meme-grade share cards rendered as OG images. Three templates:
     • summon    — "WE RIDE AT 5 · GILT BAR · $6 MARTINIS · DON'T BE LATE"
     • receipt   — money-saved flex with badges
     • challenge — "$20. THREE BARS. PROVE IT."
   Shared as a URL (e.g. /share?t=summon&...) so it unfurls big in any group
   chat. All params are caller-supplied strings — no fabrication here. */

const INK = "#16100B";
const AMBER = "#FFB52E";
const RED = "#FF4530";
const CREAM = "#F3E9DA";
const BRASS = "#C49A6C";

function clamp(s: string | null, n: number): string {
  return (s ?? "").slice(0, n);
}

export function GET(req: Request) {
  const u = new URL(req.url);
  const t = u.searchParams.get("t") ?? "summon";
  const headline = clamp(u.searchParams.get("headline"), 40);
  const sub = clamp(u.searchParams.get("sub"), 60);
  const footer = clamp(u.searchParams.get("footer"), 60);

  const accent = t === "challenge" ? RED : AMBER;
  const kicker =
    t === "receipt" ? "THE RECEIPT" : t === "challenge" ? "THE CHALLENGE" : "WE RIDE";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
          backgroundColor: INK,
          backgroundImage:
            "radial-gradient(circle at 25% 15%, rgba(255,181,46,0.12), transparent 45%), radial-gradient(circle at 80% 85%, rgba(255,69,48,0.12), transparent 45%)",
          fontFamily: "sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: accent,
            fontSize: 34,
            letterSpacing: 16,
            fontWeight: 900,
            textTransform: "uppercase",
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            color: CREAM,
            fontSize: headline.length > 22 ? 92 : 120,
            fontWeight: 900,
            lineHeight: 1.02,
            marginTop: 24,
            textShadow: `0 0 24px ${accent}aa, 0 0 60px ${accent}55`,
          }}
        >
          {headline || "LAST CALL"}
        </div>
        {sub ? (
          <div style={{ color: accent, fontSize: 52, fontWeight: 800, marginTop: 28 }}>
            {sub}
          </div>
        ) : null}
        {footer ? (
          <div style={{ color: BRASS, fontSize: 34, marginTop: 24, letterSpacing: 2 }}>
            {footer}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 56,
            color: BRASS,
            fontSize: 26,
            letterSpacing: 8,
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: RED }}>●</span> LAST CALL · CHICAGO
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
