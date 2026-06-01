// frontend/src/lib/sources/ranking-bm25.ts
// Proper BM25 ranker. Replaces the heuristic sum ranker. Operates over the
// result corpus (the projects that actually came back from fetching) — this
// is a re-ranker, not web-scale retrieval.

import type { SourceType, UnifiedProject } from "./types";
import type { ExpandQueryResult } from "./synonyms";
import { INTENT_WEIGHTS } from "./intent";

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

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

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

// Weighted document length: Σ_field weight_field × |tokens_field|.
function weightedLen(f: DocFields): number {
  return (
    FIELD_WEIGHTS.name * f.name.length +
    FIELD_WEIGHTS.fullName * f.fullName.length +
    FIELD_WEIGHTS.topics * f.topics.length +
    FIELD_WEIGHTS.description * f.description.length +
    FIELD_WEIGHTS.language * f.language.length
  );
}

// BM25F weighted term frequency: combine per-field counts with field weights
// BEFORE the saturation function, so a name hit contributes its full weight.
function weightedTf(f: DocFields, term: string): number {
  const c = (arr: string[]) => {
    let n = 0;
    for (const t of arr) if (t === term) n++;
    return n;
  };
  return (
    FIELD_WEIGHTS.name * c(f.name) +
    FIELD_WEIGHTS.fullName * c(f.fullName) +
    FIELD_WEIGHTS.topics * c(f.topics) +
    FIELD_WEIGHTS.description * c(f.description) +
    FIELD_WEIGHTS.language * c(f.language)
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

  const fields = projects.map(docFields);
  const wLens = fields.map(weightedLen);
  const avgWLen = wLens.reduce((a, b) => a + b, 0) / fields.length || 1;
  const N = fields.length;

  const userTokens = tokenize(rawQuery);
  const expansionTokens = expansion.expandedTerms
    .flatMap((e) => tokenize(e))
    .filter((t) => !userTokens.includes(t));

  const allTerms = Array.from(new Set([...userTokens, ...expansionTokens]));
  const termWeight = (t: string) => (userTokens.includes(t) ? 1.0 : 0.5);

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
    let bm25 = 0;
    for (const term of allTerms) {
      const wtf = weightedTf(f, term);
      if (wtf === 0) continue;
      const num = wtf * (K1 + 1);
      const denom = wtf + K1 * (1 - B + (B * wLen) / avgWLen);
      bm25 += termWeight(term) * idf[term] * (num / denom);
    }

    let score = bm25 * 1000;

    // Exact-name boost — the single strongest "this is THE answer" signal.
    // A query that *is* a project's name (zustand → pmndrs/zustand) or whose
    // token equals the name should win outright, regardless of star count.
    const nameLc = p.name.toLowerCase();
    const fullLc = p.fullName.toLowerCase();
    if (queryLc && (nameLc === queryLc || fullLc === queryLc || fullLc.endsWith(`/${queryLc}`))) {
      score += 3000;
    } else if (userTokens.includes(nameLc)) {
      score += 1500;
    }

    // Popularity
    if (p.stars > 0) score += Math.min(Math.log10(p.stars + 1) * 400, 3500);
    // Some registries (npm) expose weekly downloads but not `downloads`;
    // fall back so package popularity still counts.
    const downloads = p.downloads || p.weeklyDownloads || 0;
    if (downloads > 0) {
      score += Math.min(Math.log10(downloads + 1) * 200, 2000);
    }
    // Honest 0..1 popularity (npm search score) for sources with no star or
    // download count. Capped at +2400 — on par with a few-thousand-star repo.
    if (p.popularityScore && p.popularityScore > 0) {
      score += Math.min(p.popularityScore, 1) * 2400;
    }

    // Recency
    const ageDays = (Date.now() - new Date(p.updatedAt).getTime()) / 86_400_000;
    if (ageDays < 7) score += 500;
    else if (ageDays < 30) score += 300;
    else if (ageDays < 90) score += 150;
    else if (ageDays > 730) score -= 500;
    else if (ageDays > 365) score -= 200;

    // Source baseline
    const srcBonus: Record<SourceType, number> = {
      github: 150, huggingface: 140, npm: 120, pypi: 120, crates: 120,
      packagist: 110, rubygems: 110, gitlab: 100, codeberg: 100,
      dockerhub: 120, jsr: 110, flathub: 105, homebrew: 110, fdroid: 100,
      arxiv: 110, paperswithcode: 115, stackoverflow: 95, hackernews: 90,
      reddit: 90, lobsters: 90, devto: 85, aur: 100, openvsx: 110,
      conda: 115, zenodo: 105, nuget: 120, wordpress: 105, maven: 120,
    };
    score += srcBonus[p.source] ?? 0;

    // Intent weighting — nudge the sources that match the regex-detected
    // query intent (e.g. "llama 3 model" → huggingface up; "how to deploy …"
    // → reddit/discussion up). Previously computed but only used to tint the
    // background hue; now it actually moves results.
    const intentWeight = INTENT_WEIGHTS[expansion.intent]?.[p.source];
    if (intentWeight) score += intentWeight * INTENT_SCALE;

    // Trending
    if (p.stars >= 1000 && ageDays < 90) score += 800;
    if (p.stars >= 10_000 && ageDays < 180) score += 400;

    // Zero-signal penalty
    const noStars = p.stars === 0;
    const noDownloads = !p.downloads || p.downloads === 0;
    const noDesc = !p.description || p.description.length < 20;
    if (noStars && noDownloads && noDesc) score -= 600;

    // Boost list
    if (boostSet.has(p.fullName.toLowerCase())) score += 2000;

    return { project: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.project);
}
