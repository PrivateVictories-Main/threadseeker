// Iter-20 / Overhaul F — tiny inline-SVG sparkline for "recent commits"
// or "release cadence" microcharts in the expanded card panel. Renders
// only when caller passes >= 2 numeric values; otherwise returns null
// (caller hides the row).
//
// Visual register: indigo bars on a transparent background. Uses
// tabular-nums for the trailing label. Compact enough to sit alongside
// a one-line summary ("Last 30 days: 24 commits").

interface Props {
  // Numeric series, oldest -> newest. Empty/length<2 -> hidden.
  values: number[];
  // Optional label rendered to the right (e.g. "12w").
  label?: string;
  // Pixel width / height. Height drives bar height; width drives bar pitch.
  width?: number;
  height?: number;
}

export function Sparkline({ values, label, width = 88, height = 22 }: Props) {
  if (!values || values.length < 2) return null;

  const max = Math.max(...values, 1);
  // Bar mode: each bar is (width / n) wide with a 1px gap. Indigo fill.
  const n = values.length;
  const barW = Math.max(1.5, (width - (n - 1)) / n);

  return (
    <span className="ts-sparkline" aria-hidden>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {values.map((v, i) => {
          const h = Math.max(1, (v / max) * (height - 2));
          const x = i * (barW + 1);
          const y = height - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              fill="rgba(99, 102, 241, 0.55)"
              rx="0.5"
            />
          );
        })}
      </svg>
      {label && <span className="ts-sparkline-label">{label}</span>}
    </span>
  );
}
