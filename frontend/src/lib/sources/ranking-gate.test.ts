import { describe, it, expect } from "vitest";
import { rankCorpus } from "./ranking-bm25";
import { mergeRelatedProjects } from "./merge";
import { expandQuery } from "./synonyms";
import { RANKING_CASES } from "./ranking-fixtures";

// Offline ranking-quality gate. Runs each canonical query through the SAME
// merge + rank pipeline production uses (no network) and asserts the ideal
// project ranks well. This is the deterministic guard for the product's core
// promise — "finds EXACTLY the right project" — that the manual network
// backtest (scripts/backtest.ts) can't provide in CI.
function rankFor(c: (typeof RANKING_CASES)[number]) {
  const merged = mergeRelatedProjects(c.corpus);
  return rankCorpus(merged, c.query, expandQuery(c.query)).map((p) => p.fullName);
}

describe("ranking quality gate", () => {
  for (const c of RANKING_CASES) {
    it(`"${c.query}" → ${c.idealWinner} is in the top 3`, () => {
      const ranked = rankFor(c);
      expect(ranked.slice(0, 3)).toContain(c.idealWinner);
    });
  }

  it("aggregate P@1 ≥ 0.7 and P@3 = 1.0 across all canonical queries", () => {
    let p1 = 0;
    let p3 = 0;
    for (const c of RANKING_CASES) {
      const ranked = rankFor(c);
      if (ranked[0] === c.idealWinner) p1++;
      if (ranked.slice(0, 3).includes(c.idealWinner)) p3++;
    }
    const n = RANKING_CASES.length;
    // P@3 must be perfect — the canonical answer should never fall out of the
    // top 3 for a textbook query. P@1 is a softer floor (popularity legitimately
    // shuffles the very top among near-peers).
    expect(p3 / n).toBe(1);
    expect(p1 / n).toBeGreaterThanOrEqual(0.7);
  });
});
