"use client";
import { useStore, type FilterKey } from "@/store/useStore";
import { cn } from "@/lib/utils";

const CHIPS: { key: FilterKey; label: string }[] = [
  { key: "live", label: "Live now" },
  { key: "beer", label: "Beer" },
  { key: "cocktails", label: "Cocktails" },
  { key: "food", label: "Food" },
  { key: "dives", label: "Dives" },
  { key: "patio", label: "Patio" },
  { key: "walk15", label: "≤15 min walk" },
  { key: "hasDeals", label: "Has deals" },
];

export function FilterChips({ extra }: { extra?: { key: FilterKey; label: string }[] }) {
  const filters = useStore((s) => s.filters);
  const toggle = useStore((s) => s.toggleFilter);
  const chips = extra ? [...CHIPS, ...extra] : CHIPS;

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
      {chips.map(({ key, label }) => {
        const active = filters.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            aria-pressed={active}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
              active
                ? "border-neon-amber bg-neon-amber/15 text-neon-amber"
                : "border-brass/25 bg-surface text-brass hover:border-brass/50"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
