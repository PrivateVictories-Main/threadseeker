// Offline search-quality harness. Runs the canonical query set against the
// live adapters and scores the ranking pipeline with precision@3, MRR, and
// an "ideal winner" hit rate. Meant to be run manually when tuning ranking
// weights, NOT as part of CI (hits upstream rate limits, flaky by design).
//
//   $ npm run backtest                         # full suite
//   $ npm run backtest -- --only exact-name    # one category
//   $ npm run backtest -- --query react        # single query, verbose
//
// The proxy/backend-gated sources (reddit, arxiv, homebrew, f-droid,
// wordpress) return empty without a running Pages Functions instance; the
// harness sets NEXT_PUBLIC_BACKEND_URL=disabled to suppress those calls.

import {
  searchAllSources,
  mergeRelatedProjects,
  rankCorpus,
  expandQuery,
  coreSearchQuery,
  buildSearchQuery,
  UnifiedProject,
  SourceType,
} from "../src/lib/sources";
import { BACKTEST_QUERIES, type BacktestQuery, type QueryCategory } from "./backtest-queries";

// Force backend-gated sources into a deterministic no-op state.
process.env.NEXT_PUBLIC_BACKEND_URL = "disabled";

interface Flags {
  only?: QueryCategory;
  query?: string;
  topN: number;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { topN: 3 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--only") flags.only = argv[++i] as QueryCategory;
    else if (a === "--query") flags.query = argv[++i];
    else if (a === "--top") flags.topN = Number(argv[++i] || "3");
  }
  return flags;
}

function projectMatches(p: UnifiedProject, expected: string): boolean {
  const needle = expected.toLowerCase();
  return (
    p.name.toLowerCase().includes(needle) ||
    p.fullName.toLowerCase().includes(needle)
  );
}

interface QueryResult {
  query: BacktestQuery;
  top: UnifiedProject[];
  precisionAtN: number;
  reciprocalRank: number;
  idealWinnerHit: boolean | null;
  idealWinnerRank: number | null;
}

async function runQuery(q: BacktestQuery, topN: number): Promise<QueryResult> {
  // Mirror the production search pipeline (page.tsx handleSearch) so the
  // harness scores what users actually SEE: deterministic key-term reduction
  // for the upstream fetch + OR-expansion for OR-sources, then the BM25F
  // re-rank over the merged corpus. (The AI optimize step is absent here —
  // matching the no-key production path, which falls back to coreSearchQuery.)
  const freeText = q.query;
  const expansion = expandQuery(freeText);
  const fetchQuery = coreSearchQuery(freeText);
  const overrides: Partial<Record<SourceType, string>> = {};
  const orExpanded = buildSearchQuery(fetchQuery, expansion, { supportsOr: true });
  if (orExpanded !== fetchQuery) {
    overrides.github = orExpanded;
    overrides.gitlab = orExpanded;
    overrides.codeberg = orExpanded;
  }
  const raw = await searchAllSources(fetchQuery, undefined, true, overrides);
  const ranked = rankCorpus(mergeRelatedProjects(raw), freeText, expansion);
  const top = ranked.slice(0, Math.max(topN, 10));

  const matched = top.slice(0, topN).filter((p) =>
    q.expected.some((e) => projectMatches(p, e)),
  );
  const precisionAtN = matched.length > 0 ? 1 : 0;

  const firstHitIdx = top.findIndex((p) =>
    q.expected.some((e) => projectMatches(p, e)),
  );
  const reciprocalRank = firstHitIdx >= 0 ? 1 / (firstHitIdx + 1) : 0;

  let idealWinnerHit: boolean | null = null;
  let idealWinnerRank: number | null = null;
  if (q.idealWinner) {
    const winnerIdx = top.findIndex((p) => projectMatches(p, q.idealWinner!));
    idealWinnerHit = winnerIdx === 0;
    idealWinnerRank = winnerIdx >= 0 ? winnerIdx + 1 : null;
  }

  return { query: q, top, precisionAtN, reciprocalRank, idealWinnerHit, idealWinnerRank };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function printQueryResult(r: QueryResult, verbose: boolean) {
  const hit = r.precisionAtN > 0 ? "PASS" : "FAIL";
  const mrr = r.reciprocalRank.toFixed(2);
  const winner =
    r.idealWinnerHit === null ? "—" : r.idealWinnerHit ? "W#1" : r.idealWinnerRank ? `W#${r.idealWinnerRank}` : "W—";
  console.log(
    `  ${pad(hit, 4)}  P@3=${r.precisionAtN}  MRR=${pad(mrr, 4)}  ${pad(winner, 5)}  "${r.query.query}"`,
  );
  if (verbose) {
    r.top.slice(0, 5).forEach((p, idx) => {
      console.log(
        `      ${idx + 1}. [${pad(p.source, 12)}] ${p.fullName}  ⭐${p.stars}`,
      );
    });
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  let queries = BACKTEST_QUERIES;
  if (flags.only) queries = queries.filter((q) => q.category === flags.only);
  if (flags.query) queries = queries.filter((q) => q.query === flags.query);
  if (queries.length === 0) {
    console.error("No queries matched the filter.");
    process.exit(1);
  }

  console.log(`\nThreadSeeker backtest — ${queries.length} queries\n`);

  // Group output by category so weak categories jump out.
  const byCategory = new Map<QueryCategory, QueryResult[]>();
  const all: QueryResult[] = [];

  for (const q of queries) {
    const r = await runQuery(q, flags.topN);
    all.push(r);
    const bucket = byCategory.get(q.category) || [];
    bucket.push(r);
    byCategory.set(q.category, bucket);
  }

  for (const [cat, results] of byCategory) {
    console.log(`\n${cat}`);
    const sorted = [...results].sort((a, b) => b.precisionAtN - a.precisionAtN);
    const verbose = !!flags.query;
    for (const r of sorted) printQueryResult(r, verbose);

    const pAt3 = results.reduce((s, r) => s + r.precisionAtN, 0) / results.length;
    const mrr = results.reduce((s, r) => s + r.reciprocalRank, 0) / results.length;
    console.log(
      `  -> P@3 ${(pAt3 * 100).toFixed(0)}%  MRR ${mrr.toFixed(2)}  (${results.length} queries)`,
    );
  }

  const overallP = all.reduce((s, r) => s + r.precisionAtN, 0) / all.length;
  const overallMRR = all.reduce((s, r) => s + r.reciprocalRank, 0) / all.length;
  const winners = all.filter((r) => r.idealWinnerHit !== null);
  const winnerRate =
    winners.length > 0
      ? winners.reduce((s, r) => s + (r.idealWinnerHit ? 1 : 0), 0) / winners.length
      : 0;

  console.log("\n================================");
  console.log(`Overall P@3:          ${(overallP * 100).toFixed(1)}%`);
  console.log(`Overall MRR:          ${overallMRR.toFixed(3)}`);
  console.log(
    `Ideal winner at #1:   ${(winnerRate * 100).toFixed(1)}%  (${winners.length} tagged)`,
  );
  console.log("================================\n");

  const failures = all.filter((r) => r.precisionAtN === 0);
  if (failures.length > 0) {
    console.log(`${failures.length} misses:`);
    for (const f of failures) {
      console.log(`  - "${f.query.query}" (${f.query.category})`);
      console.log(
        `      expected any of: ${f.query.expected.slice(0, 5).join(", ")}`,
      );
      console.log(
        `      got: ${f.top.slice(0, 3).map((p) => p.fullName).join(", ") || "(nothing)"}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
