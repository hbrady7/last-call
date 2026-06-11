import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LAST CALL — Chicago Happy Hour Radar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
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
          backgroundColor: "#16100B",
          backgroundImage:
            "radial-gradient(circle at 25% 20%, rgba(255,181,46,0.10), transparent 45%), radial-gradient(circle at 80% 80%, rgba(255,69,48,0.10), transparent 45%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            color: "#C49A6C",
            fontSize: 30,
            letterSpacing: 14,
            textTransform: "uppercase",
          }}
        >
          Chicago · Happy Hour Radar
        </div>
        <div
          style={{
            color: "#FFB52E",
            fontSize: 170,
            fontWeight: 900,
            lineHeight: 1,
            marginTop: 12,
            textShadow:
              "0 0 20px rgba(255,181,46,0.7), 0 0 50px rgba(255,181,46,0.4)",
          }}
        >
          LAST CALL
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 30,
            color: "#F3E9DA",
            fontSize: 34,
          }}
        >
          <span style={{ color: "#FF4530" }}>●</span>
          <span>Every live deal within 2 miles, ranked by Steal Score</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
