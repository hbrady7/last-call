"use client";
import { Heart as HeartIcon } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

export function Heart({ venueId, className }: { venueId: string; className?: string }) {
  const favorite = useStore((s) => s.favorites.includes(venueId));
  const toggle = useStore((s) => s.toggleFavorite);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(venueId);
      }}
      aria-pressed={favorite}
      aria-label={favorite ? "Remove from favorites" : "Save to favorites"}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors active:scale-90",
        favorite ? "text-live-red" : "text-muted hover:text-brass",
        className
      )}
    >
      <HeartIcon
        className="h-5 w-5"
        fill={favorite ? "currentColor" : "none"}
        strokeWidth={2}
      />
    </button>
  );
}
