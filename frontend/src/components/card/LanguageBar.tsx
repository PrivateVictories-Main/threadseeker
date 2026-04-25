// Iter-20 / Overhaul F — horizontal stacked bar of top languages by
// percent. Used in the expanded card panel for repo-shape projects. If
// the repo only carries a single language string (no breakdown), the bar
// renders as a single-segment 100% indigo bar — still informative as a
// "primary language: X" cue.
//
// Source data: project.languageBreakdown ({ "TypeScript": 64.2, "CSS": 21 })
// Adapters do not currently fill this — the GitHub /languages endpoint
// would be a separate fetch. Component renders gracefully empty when
// the field is absent.

interface Props {
  breakdown?: Record<string, number>;
  fallbackLanguage?: string | null;
}

// Stable color palette for languages. We intentionally don't use the
// "github linguist" colors — the indigo/violet/sky palette keeps the
// brand cohesion. Rotate through the palette by index.
const PALETTE = [
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#0ea5e9", // sky-500
  "#14b8a6", // teal-500
  "#f59e0b", // amber-500 (only at the tail)
  "#ec4899", // pink-500
];

export function LanguageBar({ breakdown, fallbackLanguage }: Props) {
  const entries =
    breakdown && Object.keys(breakdown).length > 0
      ? Object.entries(breakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      : fallbackLanguage
        ? [[fallbackLanguage, 100] as [string, number]]
        : [];

  if (entries.length === 0) return null;

  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;

  return (
    <div className="ts-lang-bar-wrap">
      <div className="ts-lang-bar" role="img" aria-label="Language breakdown">
        {entries.map(([lang, pct], i) => (
          <span
            key={lang}
            className="ts-lang-bar-seg"
            style={{
              width: `${(pct / total) * 100}%`,
              background: PALETTE[i % PALETTE.length],
            }}
            title={`${lang} ${pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="ts-lang-bar-legend">
        {entries.map(([lang, pct], i) => (
          <span className="ts-lang-bar-legend-item" key={lang}>
            <span
              className="ts-lang-bar-legend-swatch"
              style={{ background: PALETTE[i % PALETTE.length] }}
              aria-hidden
            />
            <span className="ts-lang-bar-legend-name">{lang}</span>
            {entries.length > 1 && (
              <span className="ts-lang-bar-legend-pct">{pct.toFixed(1)}%</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
