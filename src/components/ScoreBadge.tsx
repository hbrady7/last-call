import { cn } from "@/lib/utils";
import type { DealState } from "@/lib/engine/status";

/** Circular Steal Score badge. LIVE glows, SOON solid amber, else dim brass. */
export function ScoreBadge({
  score,
  state,
  size = "md",
}: {
  score: number;
  state: DealState;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "lg" ? "h-14 w-14 text-xl" : size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  return (
    <div
      className={cn(
        "tabular grid shrink-0 place-items-center rounded-full border font-semibold leading-none",
        dims,
        state === "LIVE" &&
          "border-live-red/70 bg-live-red/15 text-live-red neon-red",
        state === "STARTS_SOON" &&
          "border-neon-amber/70 bg-neon-amber/15 text-neon-amber",
        (state === "LATER_TODAY" || state === "NOT_TODAY") &&
          "border-brass/40 bg-surface-2 text-brass"
      )}
      aria-label={`Steal Score ${score} out of 100`}
    >
      {score}
    </div>
  );
}
