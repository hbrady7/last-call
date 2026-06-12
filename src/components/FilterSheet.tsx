"use client";
import { motion } from "framer-motion";
import { X, Ticket } from "lucide-react";
import { FilterChips } from "./FilterChips";
import { BudgetBar } from "./BudgetBar";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

/** Everything that used to crowd the first screen — chips + budget — now lives
 *  behind one Filters button, in a sheet that's out of the way until summoned. */
export function FilterSheet({ onClose }: { onClose: () => void }) {
  const filters = useStore((s) => s.filters);
  const clearAll = useStore((s) => s.clearFilters);
  const showEvents = useStore((s) => s.showEvents);
  const toggleEvents = useStore((s) => s.toggleEvents);

  return (
    <motion.div
      className="fixed inset-0 z-[1300] flex items-end bg-ink/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full rounded-t-3xl border-t border-brass/25 bg-ink pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between px-4">
          <h2 className="font-display text-lg text-cream">Filters</h2>
          <div className="flex items-center gap-3">
            {filters.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[12px] text-muted underline"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close filters"
              className="grid h-8 w-8 place-items-center rounded-full border border-brass/30 text-brass"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <FilterChips />
        <div className="mt-1">
          <BudgetBar />
        </div>
        <div className="mt-2 flex items-center justify-between px-4">
          <span className="flex items-center gap-2 text-[13px] text-cream">
            <Ticket className="h-4 w-4 text-event" /> Chicago events on the map
          </span>
          <button
            type="button"
            onClick={toggleEvents}
            role="switch"
            aria-checked={showEvents}
            aria-label="Toggle Chicago events"
            className={cn(
              "relative h-6 w-11 rounded-full border transition-colors",
              showEvents ? "border-event bg-event/30" : "border-brass/30 bg-surface"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full transition-all",
                showEvents ? "left-[22px] bg-event" : "left-0.5 bg-brass"
              )}
            />
          </button>
        </div>
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-coaster bg-neon-amber py-2.5 font-display text-[14px] text-ink active:scale-[0.99]"
          >
            Show me
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
