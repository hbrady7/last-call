"use client";
import { useState } from "react";
import { Play, Loader2 } from "lucide-react";

export function AdminBatchButton({ adminKey }: { adminKey: string }) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function run() {
    setState("running");
    setMsg("");
    try {
      const res = await fetch(`/api/admin/refresh?batch=1&key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "failed");
      setState("done");
      setMsg(
        `scouted ${d.scoutFound}/${d.scoutRan} · extracted ${d.extractUpdated}/${d.extractRan} — reload to see`
      );
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={state === "running"}
        className="inline-flex items-center justify-center gap-2 rounded-coaster bg-neon-amber px-4 py-2.5 font-display text-sm text-ink disabled:opacity-60"
      >
        {state === "running" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        Run next batch (scout 10 + extract 10)
      </button>
      {msg && (
        <span className={`text-[11px] ${state === "error" ? "text-live-red" : "text-muted"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
