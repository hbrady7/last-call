import {
  Music,
  PartyPopper,
  Trophy,
  Mic,
  Palette,
  Clapperboard,
  type LucideIcon,
} from "lucide-react";
import type { EventCategory } from "@/lib/types";

export const EVENT_META: Record<
  EventCategory,
  { icon: LucideIcon; label: string }
> = {
  music: { icon: Music, label: "Music" },
  festival: { icon: PartyPopper, label: "Festival" },
  sports: { icon: Trophy, label: "Sports" },
  comedy: { icon: Mic, label: "Comedy" },
  arts: { icon: Palette, label: "Arts" },
  film: { icon: Clapperboard, label: "Film" },
};

/** Cheapest ticket → short price hook for an event. */
export function eventPriceLabel(free: boolean, priceFrom: number | null): string {
  if (free) return "Free";
  if (priceFrom == null) return "Ticketed";
  return `From $${priceFrom}`;
}
