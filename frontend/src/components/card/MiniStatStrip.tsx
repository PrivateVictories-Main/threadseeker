// Iter-20 / Overhaul F — compact 5-cell stat strip that sits between the
// description and the metric grid. Mono labels above tabular-numeric
// values. Source-aware via miniStatsForProject(). The strip is purely
// presentational; data shaping lives in helpers.ts so it stays
// unit-testable.
//
// Visual register: smaller than the metric grid, larger than a footer
// caption — explicitly the "second tier" of the card. Reads as
// dev-tool readout (think Linear / Vercel) rather than content body.

import type { MiniStat } from "./helpers";

interface Props {
  stats: MiniStat[];
}

export function MiniStatStrip({ stats }: Props) {
  if (!stats.length) return null;
  return (
    <div className="ts-mini-stat-strip" role="list">
      {stats.map((s) => (
        <div className="ts-mini-stat" key={s.label} role="listitem" title={s.title}>
          <span className="ts-mini-stat-label">{s.label}</span>
          <span className="ts-mini-stat-value">{s.value}</span>
        </div>
      ))}
    </div>
  );
}
