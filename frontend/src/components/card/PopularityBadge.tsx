// Iter-15 — "why is this popular" badge for the card top-right slot.
//
// Renders one of: Hot / Trending / Rising / Established / New (or null,
// which collapses the badge entirely). Uses a small icon + label + soft
// tinted background, all sitting on the indigo–violet–rose–amber palette
// the rest of the design system stays inside.
//
// Tone:
//   - hot         → flame, amber tint (genuinely fresh + hot)
//   - trending    → trending-up, indigo (active climbing)
//   - rising      → arrow-up-right, violet (mid-band trajectory)
//   - new         → sparkles, sky (fresh)
//   - established → award, slate-emerald (long-running)
//
// Small enough to coexist with the source badge on the top row.

import { Flame, TrendingUp, ArrowUpRight, Sparkles, Award } from "lucide-react";
import { popularityClassLabel, type PopularityClass } from "./helpers";

interface PopularityBadgeProps {
  cls: PopularityClass;
  /** Optional hover hint — e.g. "1.2k stars in under a month" */
  reason?: string;
}

const ICON_BY_CLASS = {
  hot: Flame,
  trending: TrendingUp,
  rising: ArrowUpRight,
  new: Sparkles,
  established: Award,
} as const;

export function PopularityBadge({ cls, reason }: PopularityBadgeProps) {
  if (!cls) return null;
  const Icon = ICON_BY_CLASS[cls];
  const label = popularityClassLabel(cls);
  return (
    <span
      className={`ts-pop-badge ts-pop-badge-${cls}`}
      title={reason || label}
      aria-label={reason ? `${label}: ${reason}` : label}
    >
      <Icon className="w-3 h-3" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
