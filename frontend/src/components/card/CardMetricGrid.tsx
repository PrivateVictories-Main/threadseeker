// Iter-15 — info-density metric grid for UnifiedProjectCard.
//
// Renders up to three compact metric cells in a 3-column grid, each with:
//   - 10px uppercase tracked label
//   - 15px tabular-nums semibold value
//
// Source-specific fields are picked by metricsForProject() in helpers.ts.
// Cells with no value are dropped at that layer, so this component just
// receives a 0-3 length array. When the array is empty the component
// renders nothing (caller can also short-circuit).
//
// Visual treatment matches Linear/Vercel-style dashboards: very compact
// rows, monospace numbers, faint label tracking. Values inherit
// `--ts-text` for clarity; labels use `--ts-text-faint` (uppercase
// micro-label tier) so the eye reads value-first.

import type { MetricCell } from "./helpers";

export interface CardMetricGridProps {
  cells: MetricCell[];
}

export function CardMetricGrid({ cells }: CardMetricGridProps) {
  if (!cells || cells.length === 0) return null;
  return (
    <div className="ts-metric-grid" role="list">
      {cells.map((c) => (
        <div
          key={c.label}
          className="ts-metric-cell"
          role="listitem"
          title={c.title}
        >
          <span className="ts-metric-label">{c.label}</span>
          <span className="ts-metric-value">{c.value}</span>
        </div>
      ))}
    </div>
  );
}
