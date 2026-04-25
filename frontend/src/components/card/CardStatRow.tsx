// Iter-21 / Overhaul G — unified single-row stat strip.
//
// Replaces both the 3-cell metric grid AND the 5-cell mini-strip from
// Overhaul A/F with one clean horizontal row of inline icon + number
// segments separated by faint middots. HF-clean register: the row reads
// at a glance and never crowds the card.
//
// Empty data drops at the helper layer (cardStatRow in helpers.ts), so
// this component just receives a 0-N array and renders middot-separated
// segments. When the array is empty the component renders nothing.

import type { StatSegment } from "./helpers";
import { Fragment } from "react";

interface Props {
  segments: StatSegment[];
}

export function CardStatRow({ segments }: Props) {
  if (!segments || segments.length === 0) return null;
  return (
    <div className="ts-stat-row" role="list">
      {segments.map((s, i) => (
        <Fragment key={`${s.icon}-${s.value}-${i}`}>
          {i > 0 && (
            <span className="ts-stat-row-sep" aria-hidden>
              ·
            </span>
          )}
          <span className="ts-stat-row-seg" role="listitem" title={s.title}>
            <span className="ts-stat-row-icon" aria-hidden>
              {s.icon}
            </span>
            <span className="ts-stat-row-val">{s.value}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}
