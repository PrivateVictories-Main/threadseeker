// Iter-15 — "why is this popular" badge for the card top-right slot.
// Iter-21 / Overhaul G — text-only treatment. HF/Spotify don't ship loud
// "HOT" pills; the new presentation is `● HOT` in the class color, no
// boxed background, no border, no icon. Reads as a status flag — small
// but intentional.

import { popularityClassLabel, popularityClassDotColor, type PopularityClass } from "./helpers";

interface PopularityBadgeProps {
  cls: PopularityClass;
  /** Optional hover hint — e.g. "1.2k stars in under a month" */
  reason?: string;
}

export function PopularityBadge({ cls, reason }: PopularityBadgeProps) {
  if (!cls) return null;
  const label = popularityClassLabel(cls);
  const color = popularityClassDotColor(cls);
  return (
    <span
      className={`ts-pop-badge ts-pop-badge-${cls}`}
      title={reason || label}
      aria-label={reason ? `${label}: ${reason}` : label}
    >
      <span
        className="ts-pop-badge-dot"
        style={{ color }}
        aria-hidden
      >
        ●
      </span>
      <span className="ts-pop-badge-label" style={{ color }}>
        {label}
      </span>
    </span>
  );
}
