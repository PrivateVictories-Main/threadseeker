// frontend/src/lib/sources/ranking-bm25.ts
// Proper BM25 ranker. Replaces the heuristic sum ranker. Operates over the
// result corpus (the projects that actually came back from fetching) — this
// is a re-ranker, not web-scale retrieval.

import type { SourceType, UnifiedProject } from "./types";
import type { ExpandQueryResult } from "./synonyms";
import { INTENT_WEIGHTS } from "./intent";
import { FILLER_WORDS, extractKeyTerms } from "./resilience";

// How hard the regex-detected query intent nudges matching sources. A weight
// of 0.7 (e.g. huggingface for a model_search) → +560, comparable to a
// ~30-star repo's popularity bonus: enough to break ties toward the right
// source, never enough to float a junk result over a strong one.
const INTENT_SCALE = 800;

const K1 = 1.2;
const B = 0.75;

// BM25F field weights. A term in the project *name* matters far more than the
// same term buried in a description — so a low-star exact-name match can beat a
// 45k-star repo that merely mentions the term in passing. (Previously every
// field was flattened into one bag, so a name hit scored like a description
// hit.) name 4× · fullName 2× · topics 2× · description 1× · language 1×.
const FIELD_WEIGHTS = {
  name: 4,
  fullName: 2,
  topics: 2,
  description: 1,
  language: 1,
} as const;

// Language/runtime names whose identity lives in punctuation the tokenizer
// would otherwise destroy ("c++" → "c"). Normalized to stable word-tokens on
// BOTH query and document text, so "c++ json library" can actually match a
// C++ project instead of dissolving into a bare "c".
function normalizeTechTerms(text: string): string {
  return text
    .replace(/c\+\+/g, "cpp")
    .replace(/(^|[^a-z0-9])c#/g, "$1csharp")
    .replace(/(^|[^a-z0-9])f#/g, "$1fsharp")
    .replace(/\.net(\b|$)/g, "dotnet$1")
    .replace(/node\.js/g, "nodejs")
    .replace(/next\.js/g, "nextjs")
    .replace(/vue\.js/g, "vuejs")
    .replace(/socket\.io/g, "socketio");
}

function tokenize(text: string): string[] {
  return normalizeTechTerms((text || "").toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

// Sources whose "name" is a discussion/thread TITLE, not a project name. A
// Reddit/SO title like "What's the best self-hosted photo library?" lexically
// mirrors a natural-language query far better than the project name "immich"
// ever can — so thread titles must NOT enjoy the 4x name field weight, and
// upvotes must not count like GitHub stars. Without this, paragraph queries
// rank discussions ABOUT the thing above the thing.
const THREAD_SOURCES = new Set<SourceType>([
  "reddit", "hackernews", "stackoverflow", "lobsters", "devto",
]);

const THREAD_FIELD_WEIGHTS = {
  ...FIELD_WEIGHTS,
  name: 1,
  fullName: 1,
} as const;

interface DocFields {
  name: string[];
  fullName: string[];
  topics: string[];
  description: string[];
  language: string[];
}

function docFields(p: UnifiedProject): DocFields {
  return {
    name: tokenize(p.name),
    fullName: tokenize(p.fullName),
    topics: tokenize((p.topics || []).join(" ")),
    description: tokenize(p.description ?? ""),
    language: tokenize(p.language ?? ""),
  };
}

type FieldWeights = Record<keyof typeof FIELD_WEIGHTS, number>;

// Weighted document length: Σ_field weight_field × |tokens_field|.
function weightedLen(f: DocFields, w: FieldWeights): number {
  return (
    w.name * f.name.length +
    w.fullName * f.fullName.length +
    w.topics * f.topics.length +
    w.description * f.description.length +
    w.language * f.language.length
  );
}

// BM25F weighted term frequency: combine per-field counts with field weights
// BEFORE the saturation function, so a name hit contributes its full weight.
function weightedTf(f: DocFields, term: string, w: FieldWeights): number {
  const c = (arr: string[]) => {
    let n = 0;
    for (const t of arr) if (t === term) n++;
    return n;
  };
  return (
    w.name * c(f.name) +
    w.fullName * c(f.fullName) +
    w.topics * c(f.topics) +
    w.description * c(f.description) +
    w.language * c(f.language)
  );
}

function inAnyField(f: DocFields, term: string): boolean {
  return (
    f.name.includes(term) ||
    f.fullName.includes(term) ||
    f.topics.includes(term) ||
    f.description.includes(term) ||
    f.language.includes(term)
  );
}

/**
 * BM25 + non-lexical signals. Lower-level function is pure.
 */
export function rankCorpus(
  projects: UnifiedProject[],
  rawQuery: string,
  expansion: ExpandQueryResult,
): UnifiedProject[] {
  if (projects.length === 0) return [];

  const docWeights = projects.map((p) =>
    THREAD_SOURCES.has(p.source) ? THREAD_FIELD_WEIGHTS : FIELD_WEIGHTS,
  );
  const fields = projects.map(docFields);
  const wLens = fields.map((f, i) => weightedLen(f, docWeights[i]));
  const avgWLen = wLens.reduce((a, b) => a + b, 0) / fields.length || 1;
  const N = fields.length;

  const userTokens = tokenize(rawQuery);
  const expansionTokens = expansion.expandedTerms
    .flatMap((e) => tokenize(e))
    .filter((t) => !userTokens.includes(t));

  const allTerms = Array.from(new Set([...userTokens, ...expansionTokens]));
  // Query-framing filler ("looking", "best", "need") must barely count: repos
  // rarely contain those words but discussion titles always do, so at full
  // weight the corpus-local IDF treats filler as the RAREST (most valuable)
  // terms and hands paragraph queries to whichever thread mirrors the user's
  // phrasing. Content terms 1.0 · filler 0.2 · synonym expansions 0.5.
  const termWeight = (t: string) =>
    userTokens.includes(t) ? (FILLER_WORDS.has(t) ? 0.2 : 1.0) : 0.5;

  // The content terms of the query, for the coverage + adjacency bonuses
  // below — the two cheapest deterministic precision signals for specific
  // multi-term queries that a per-term BM25 sum structurally lacks.
  const keyTerms = extractKeyTerms(rawQuery).map(
    (t) => tokenize(t)[0] ?? t,
  ).filter((t) => t.length > 1);
  const keyBigrams: Array<[string, string]> = [];
  for (let i = 0; i + 1 < keyTerms.length; i += 1) {
    keyBigrams.push([keyTerms[i], keyTerms[i + 1]]);
  }

  const df: Record<string, number> = {};
  for (const term of allTerms) {
    df[term] = fields.filter((f) => inAnyField(f, term)).length;
  }
  const idf: Record<string, number> = {};
  for (const term of allTerms) {
    idf[term] = Math.log(1 + (N - df[term] + 0.5) / (df[term] + 0.5));
  }

  const boostSet = new Set(expansion.boostFullNames.map((s) => s.toLowerCase()));
  const queryLc = rawQuery.trim().toLowerCase();

  const scored = projects.map((p, i) => {
    const f = fields[i];
    const wLen = wLens[i];
    const fw = docWeights[i];
    let bm25 = 0;
    for (const term of allTerms) {
      const wtf = weightedTf(f, term, fw);
      if (wtf === 0) continue;
      const num = wtf * (K1 + 1);
      const denom = wtf + K1 * (1 - B + (B * wLen) / avgWLen);
      bm25 += termWeight(term) * idf[term] * (num / denom);
    }

    let score = bm25 * 1000;

    // Exact-name boost — the single strongest "this is THE answer" signal.
    // A query that *is* a project's name (zustand → pmndrs/zustand) or whose
    // token equals the name should win outright, regardless of star count.
    // The points alone can be out-stacked by popularity bonuses (and the
    // corpus-local IDF zeroes the fetch term itself), so exact matches ALSO
    // get a post-sort rank floor below — see the promotion after the sort.
    const nameLc = p.name.toLowerCase();
    const fullLc = p.fullName.toLowerCase();
    const exactName = Boolean(
      queryLc && (nameLc === queryLc || fullLc === queryLc || fullLc.endsWith(`/${queryLc}`)),
    );
    if (exactName) {
      score += 3000;
    } else if (userTokens.includes(nameLc)) {
      score += 1500;
    }

    // Term COVERAGE — matching ALL the user's content terms moderately must
    // beat matching one rare term heavily ("as specific as you want" means
    // conjunctive intent). Superlinear so full coverage stands out.
    if (keyTerms.length >= 2) {
      let matched = 0;
      for (const t of keyTerms) if (inAnyField(f, t)) matched += 1;
      score += Math.pow(matched / keyTerms.length, 1.5) * 2000;
    }
    // Bigram ADJACENCY — "react native" appearing adjacent (in name or
    // description) is a far stronger signal than both words scattered.
    if (keyBigrams.length > 0) {
      let hits = 0;
      for (const [a, b] of keyBigrams) {
        const adjacentIn = (arr: string[]) => {
          for (let k = 0; k + 1 < arr.length; k += 1) {
            if (arr[k] === a && arr[k + 1] === b) return true;
          }
          return false;
        };
        if (adjacentIn(f.name) || adjacentIn(f.description) || adjacentIn(f.fullName)) hits += 1;
      }
      score += Math.min(hits * 400, 1200);
    }

    // Popularity. Thread upvotes (mapped into `stars` by the discussion
    // adapters) are worth half a real star — a 5k-upvote thread should not
    // collect the same authority bonus as a 5k-star repo.
    const starScale = THREAD_SOURCES.has(p.source) ? 0.5 : 1;
    if (p.stars > 0) score += Math.min(Math.log10(p.stars + 1) * 400, 3500) * starScale;
    // Some registries (npm) expose weekly downloads but not `downloads`;
    // fall back so package popularity still counts. Downloads and the 0..1
    // popularityScore describe the SAME thing (registry adoption) — take the
    // stronger signal, never the sum, so registry results can't stack +4400
    // of popularity and bury an exact-name match.
    const downloads = p.downloads || p.weeklyDownloads || 0;
    const downloadBonus = downloads > 0 ? Math.min(Math.log10(downloads + 1) * 200, 2000) : 0;
    const popBonus =
      p.popularityScore && p.popularityScore > 0
        ? Math.min(p.popularityScore, 1) * 2400
        : 0;
    score += Math.max(downloadBonus, popBonus);

    // Archived/read-only repos are dead ends — a heavy penalty so a deprecated
    // 40k-star repo can't out-rank a maintained exact match.
    if (p.archived) score -= 1800;

    // Recency — prefer pushedAt (last commit = true activity) over updatedAt
    // (bumps on any metadata change). Guard against blank/invalid timestamps:
    // an unknown age is an EXPLICIT neutral (no boost, no penalty), rather than
    // relying on `new Date("")` → NaN making comparisons incidentally false.
    const recencyStamp = p.pushedAt || p.updatedAt;
    const updatedTs = recencyStamp ? new Date(recencyStamp).getTime() : NaN;
    const hasAge = !Number.isNaN(updatedTs);
    const ageDays = hasAge ? (Date.now() - updatedTs) / 86_400_000 : Infinity;
    // Archived repos never count as fresh OR trending — only the penalty above.
    const fresh = hasAge && !p.archived;
    if (fresh) {
      if (ageDays < 7) score += 500;
      else if (ageDays < 30) score += 300;
      else if (ageDays < 90) score += 150;
      else if (ageDays > 730) score -= 500;
      else if (ageDays > 365) score -= 200;
    }

    // Source baseline
    const srcBonus: Record<SourceType, number> = {
      github: 150, huggingface: 140, npm: 120, pypi: 120, crates: 120,
      packagist: 110, rubygems: 110, gitlab: 100, codeberg: 100,
      dockerhub: 120, jsr: 110, flathub: 105, homebrew: 110, fdroid: 100,
      arxiv: 110, paperswithcode: 115, stackoverflow: 95, hackernews: 90,
      reddit: 90, lobsters: 90, devto: 85, aur: 100, openvsx: 110,
      conda: 115, zenodo: 105, nuget: 120, wordpress: 105, maven: 120,
      hex: 115, pub: 115,
    };
    score += srcBonus[p.source] ?? 0;

    // Intent weighting — nudge the sources that match the regex-detected
    // query intent (e.g. "llama 3 model" → huggingface up; "how to deploy …"
    // → reddit/discussion up). Previously computed but only used to tint the
    // background hue; now it actually moves results.
    const intentWeight = INTENT_WEIGHTS[expansion.intent]?.[p.source];
    if (intentWeight) score += intentWeight * INTENT_SCALE;

    // Trending — only when we actually know the age (unknown age must not
    // count as "recent" just because the sentinel compares low) and the repo
    // isn't archived.
    if (fresh && p.stars >= 1000 && ageDays < 90) score += 800;
    if (fresh && p.stars >= 10_000 && ageDays < 180) score += 400;

    // Zero-signal penalty
    const noStars = p.stars === 0;
    const noDownloads = !p.downloads || p.downloads === 0;
    const noDesc = !p.description || p.description.length < 20;
    if (noStars && noDownloads && noDesc) score -= 600;

    // Boost list
    if (boostSet.has(p.fullName.toLowerCase())) score += 2000;

    return { project: p, score, exactName };
  });

  scored.sort((a, b) => b.score - a.score);

  // Exact-name rank FLOOR: when the query *is* a project's name, that project
  // belongs in the top 3 no matter how the additive bonuses stacked for
  // mega-popular neighbors. Stable: only the best-scoring exact match moves,
  // everything else keeps its order.
  const exactIdx = scored.findIndex((s) => s.exactName);
  if (exactIdx > 2) {
    const [exact] = scored.splice(exactIdx, 1);
    scored.splice(2, 0, exact);
  }

  return scored.map((s) => s.project);
}

// Rank-fuse the deterministic BM25 ordering with an optional AI relevance
// ordering of the top `topN` ids. Robust by design: each head item's final
// position is the average of its BM25 rank and its AI rank (lower = better),
// so a partial/garbage AI response can only nudge — never tank — the order, and
// ids the AI omits keep their BM25 position. The tail (beyond topN) is
// untouched. Pure + deterministic so the blend is unit-testable without a key.
// How much the semantic (embedding cosine) ordering should count vs BM25,
// by query length. Short keyword queries are BM25's home turf (exact-name
// boost, star signals); the longer and more descriptive the query, the more
// *meaning* should dominate — a 3-sentence description is exactly where
// keyword overlap fails and embeddings shine.
export function semanticWeight(significantTokenCount: number): number {
  if (significantTokenCount <= 3) return 0.35;
  if (significantTokenCount <= 7) return 0.5;
  return 0.62;
}

// Rank-fuse the current ordering with in-browser embedding cosine scores
// (keyless semantic rerank). Same robustness contract as blendRerank: fusion
// over RANKS (not raw scores) bounded by `weight`, so a degenerate embedding
// pass can shuffle — never explode — the order. Docs the scorer missed keep
// their current rank as their semantic rank (neutral). The tail beyond the
// scored head is untouched. Pure + deterministic for unit tests.
export function blendSemantic(
  projects: UnifiedProject[],
  scores: Map<string, number>,
  weight: number,
  topN = 150,
): UnifiedProject[] {
  if (!scores || scores.size === 0 || projects.length === 0) return projects;
  const w = Math.min(Math.max(weight, 0), 0.8);
  const head = projects.slice(0, topN);
  const tail = projects.slice(topN);
  const basePos = new Map(head.map((p, i) => [p.id, i]));
  // Semantic ranking of the head: scored items ordered by cosine (desc).
  const scored = head
    .filter((p) => scores.has(p.id))
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  const semPos = new Map(scored.map((p, i) => [p.id, i]));
  const fusedScore = (id: string) =>
    w * (semPos.get(id) ?? basePos.get(id)!) + (1 - w) * basePos.get(id)!;
  const fused = [...head].sort((a, b) => fusedScore(a.id) - fusedScore(b.id));
  return [...fused, ...tail];
}

export function blendRerank(
  projects: UnifiedProject[],
  aiOrder: string[],
  topN = 20,
): UnifiedProject[] {
  if (!Array.isArray(aiOrder) || aiOrder.length === 0) return projects;
  const head = projects.slice(0, topN);
  const tail = projects.slice(topN);
  const bm25Pos = new Map(head.map((p, i) => [p.id, i]));
  const aiPos = new Map<string, number>();
  let rank = 0;
  for (const id of aiOrder) {
    if (bm25Pos.has(id) && !aiPos.has(id)) aiPos.set(id, rank++);
  }
  const fusedScore = (id: string) =>
    0.5 * (aiPos.get(id) ?? bm25Pos.get(id)!) + 0.5 * bm25Pos.get(id)!;
  const fused = [...head].sort((a, b) => fusedScore(a.id) - fusedScore(b.id));
  return [...fused, ...tail];
}
