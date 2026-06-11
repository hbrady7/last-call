"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function AdminRefreshButton({
  slug,
  adminKey,
}: {
  slug: string;
  adminKey: string;
}) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function refresh() {
    setState("running");
    setMsg("");
    try {
      const res = await fetch(
        `/api/admin/refresh?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(adminKey)}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      const r = data.reports?.[0];
      setState("done");
      setMsg(r ? `${r.status}${r.note ? ` · ${r.note}` : ""}` : "no target");
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : "error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={refresh}
        disabled={state === "running"}
        className="inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-surface px-3 py-1.5 text-xs text-neon-amber disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${state === "running" ? "animate-spin" : ""}`} />
        Refresh
      </button>
      {msg && (
        <span
          className={`text-[11px] ${state === "error" ? "text-live-red" : "text-muted"}`}
        >
          {msg}
        </span>
      )}
    </div>
  );
}
