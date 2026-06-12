"use client";
import { useState } from "react";
import { Flag, Check } from "lucide-react";

/** "Report bad intel" — posts the venue to /api/report, which queues a
 *  re-extraction. Optimistic, never blocks; failures degrade to the thanks
 *  state since the report is best-effort anyway. */
export function ReportIntel({ venueId }: { venueId: string }) {
  const [state, setState] = useState<"idle" | "sent">("idle");

  async function report() {
    setState("sent");
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venueId }),
      });
    } catch {
      /* best-effort */
    }
  }

  if (state === "sent") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-brass">
        <Check className="h-3.5 w-3.5" /> Flagged — we&apos;ll re-check it. Thanks.
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={report}
      className="inline-flex items-center gap-1.5 text-[12px] text-muted underline decoration-muted/40 active:text-brass"
    >
      <Flag className="h-3.5 w-3.5" /> Report bad intel
    </button>
  );
}
