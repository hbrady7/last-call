"use client";
import { useStore } from "@/store/useStore";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [10, 20, 40];

/** Set a budget; rows then show what it buys. Persisted in the store. */
export function BudgetBar() {
  const budget = useStore((s) => s.budget);
  const setBudget = useStore((s) => s.setBudget);

  return (
    <div className="flex items-center gap-2 px-4 pt-2">
      <Wallet className="h-4 w-4 shrink-0 text-brass" />
      <span className="text-[12px] text-muted">Budget</span>
      {PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setBudget(budget === p ? null : p)}
          className={cn(
            "tabular rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
            budget === p
              ? "border-neon-amber bg-neon-amber/15 text-neon-amber"
              : "border-brass/25 bg-surface text-brass"
          )}
        >
          ${p}
        </button>
      ))}
      {budget != null && (
        <button
          type="button"
          onClick={() => setBudget(null)}
          className="ml-auto text-[11px] text-muted underline"
        >
          clear
        </button>
      )}
    </div>
  );
}
