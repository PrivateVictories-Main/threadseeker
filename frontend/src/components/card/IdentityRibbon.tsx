// Iter-20 / Overhaul F — 2px vertical accent ribbon on the LEFT edge of
// each card. Color-keyed to source family so a row of cards reads as a
// striated, self-organized result list (npm-red rows / github-slate rows
// / arxiv-red rows / paper-blue rows). Subtle decorative cue, not
// load-bearing — accompanied by the existing SourceBadge text-pill.
//
// Implementation: absolute-positioned span inside .ts-card. The ribbon
// is styled via CSS with a per-source data-attribute; this component
// simply maps the source -> attribute. Rendering is handled with
// `pointer-events: none; aria-hidden` so it never intercepts clicks.

import type { SourceType } from "@/lib/sources/types";

interface Props {
  source: SourceType;
}

// Source -> ribbon class. The class drives the indigo-/red-/orange-
// tinted vertical bar in CSS. Uses the same color vocabulary as the
// SourceBadge so the two reinforce each other.
export function IdentityRibbon({ source }: Props) {
  return (
    <span
      className={`ts-identity-ribbon ts-identity-ribbon-${source}`}
      aria-hidden
    />
  );
}
