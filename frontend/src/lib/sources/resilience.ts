// frontend/src/lib/sources/resilience.ts
//
// Iter-25 / Major Overhaul K — Track 1.
//
// Query-relaxation pipeline. When the strict pass over `searchAllSources`
// returns very few results, this module decides which broader pass to run
// next. It does NOT call any network layer itself — callers thread plans
// back through the same `searchAllSources` they already use, which keeps
// streaming progress + per-source timeout semantics intact.
//
// Pipeline order (each step opt-in based on the running result count):
//
//   strict           — current behavior (raw query verbatim, OR-expanded
//                      for github/gitlab/codeberg). Already done by caller.
//   tokens           — split multi-word query into individual tokens, run
//                      each as its own query, merge. Catches phrases like
//                      "mouse tapper" that don't exist as a literal but
//                      where each token has matches.
//   distinctive      — narrow to the longest / most-specific token from
//                      the original query, run that alone. Heuristic
//                      "most-distinctive" = longest token, with stop-words
//                      filtered.
//   fuzzy-synonyms   — substring-match the user query against every
//                      synonym entry's `expandTo` array (in addition to
//                      the strict `triggers` match `expandQuery` already
//                      does). Catches "auto click" → automation entry's
//                      "autoclick" / "autoclicker".
//   first-token      — last resort: search the first significant token
//                      alone across all sources. Almost always returns
//                      *something* even if it's not laser-relevant.
//
// Each helper returns a small plan object. The caller (page.tsx) decides
// whether to run the plan based on how many cumulative results it has.

import { SYNONYMS, expandQuery, type ExpandQueryResult } from "./synonyms";

/** A single relaxed-search plan: a free-text query string + a label
 *  describing which strategy produced it. The label is surfaced in the
 *  UI as a "did you mean" / banner so the user knows we widened. */
export interface RelaxedPlan {
  query: string;
  /** Which relaxation tier produced this plan. */
  tier: "tokens" | "distinctive" | "fuzzy-synonyms" | "first-token";
  /** Human-readable explanation, e.g. `Showing related results — no exact match for "mouse tapper"` */
  banner: string;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "or", "the", "to", "of", "for", "in", "on",
  "with", "by", "is", "are", "be", "as", "at", "from", "this",
  "that", "it", "but", "not", "i", "you", "we", "they",
]);

/** Tokenize a raw query — lowercased, split on whitespace, stop-words +
 *  short tokens (< 2 chars) dropped. Stable order. */
export function significantTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}+#.\-]/gu, ""))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/** Pick the longest significant token. Ties broken by appearance order. */
export function pickDistinctiveToken(raw: string): string | null {
  const toks = significantTokens(raw);
  if (toks.length === 0) return null;
  let best = toks[0];
  for (const t of toks) {
    if (t.length > best.length) best = t;
  }
  return best;
}

/** First significant token (raw appearance order). Used as the absolute
 *  last-resort relaxation plan. */
export function pickFirstToken(raw: string): string | null {
  const toks = significantTokens(raw);
  return toks[0] ?? null;
}

/** Build a multi-token plan: each significant token joined by space.
 *  Most non-OR sources will treat this as a relaxed AND; OR-supporting
 *  sources will see it via buildSearchQuery() which already OR-joins
 *  the expansion terms.
 *
 *  Returns null when the original query is already a single token. */
export function buildTokenPlan(raw: string): RelaxedPlan | null {
  const toks = significantTokens(raw);
  if (toks.length < 2) return null;
  // Re-join tokens — caller can pass through OR-expansion later. Order
  // preserved so longer / more-distinctive tokens stay near the front.
  const queryString = toks.join(" ");
  return {
    query: queryString,
    tier: "tokens",
    banner: `Showing related results for "${raw.trim()}" — no exact match`,
  };
}

/** Build a "longest-token-only" plan. Almost always broadens enough to
 *  surface something. */
export function buildDistinctivePlan(raw: string): RelaxedPlan | null {
  const tok = pickDistinctiveToken(raw);
  if (!tok) return null;
  return {
    query: tok,
    tier: "distinctive",
    banner: `Broadened search to "${tok}" — no exact match for "${raw.trim()}"`,
  };
}

/** Build a fuzzy-synonyms plan: the existing `expandQuery` only triggers
 *  on exact substrings of `triggers`. This walks `expandTo` too and
 *  builds a synthetic query when any expandTo entry shares a token with
 *  the user's input. Returns null if no fuzzy match is found.
 *
 *  Example: query="auto click" — `expandTo` entries like "autoclick"
 *  share the "auto" token, so we surface "autoclicker xdotool autohotkey"
 *  as a relaxed plan. */
export function buildFuzzySynonymPlan(raw: string): RelaxedPlan | null {
  const userTokens = significantTokens(raw);
  if (userTokens.length === 0) return null;

  // First check: does expandQuery already trigger anything? If so, the
  // strict pass already has the expansion baked in via buildSearchQuery,
  // so a fuzzy plan would be redundant.
  const strict = expandQuery(raw);
  const strictHadExpansion = strict.expandedTerms.length > userTokens.length;
  if (strictHadExpansion) return null;

  // Walk every entry; collect entries whose expandTo contains a token
  // that contains a user token, OR vice-versa.
  const matched = new Set<string>();
  let hitConcept: string | null = null;
  for (const entry of SYNONYMS) {
    let entryHits = false;
    for (const target of entry.expandTo) {
      const targetLower = target.toLowerCase();
      for (const ut of userTokens) {
        if (targetLower.includes(ut) || ut.includes(targetLower)) {
          entryHits = true;
          break;
        }
      }
      if (entryHits) break;
    }
    // Also try triggers — sometimes the user query is a substring of a
    // trigger phrase (e.g. "tapper" inside the trigger "mouse tapper").
    if (!entryHits) {
      for (const trig of entry.triggers) {
        const trigLower = trig.toLowerCase();
        for (const ut of userTokens) {
          if (trigLower.includes(ut) && ut.length >= 3) {
            entryHits = true;
            break;
          }
        }
        if (entryHits) break;
      }
    }
    if (entryHits) {
      hitConcept = hitConcept ?? entry.concept;
      for (const t of entry.expandTo) matched.add(t.toLowerCase());
    }
  }
  if (matched.size === 0) return null;

  const top = Array.from(matched).slice(0, 6);
  return {
    query: top.join(" "),
    tier: "fuzzy-synonyms",
    banner: `Showing related projects for "${raw.trim()}"`,
  };
}

/** Build the first-token last-resort plan. */
export function buildFirstTokenPlan(raw: string): RelaxedPlan | null {
  const tok = pickFirstToken(raw);
  if (!tok) return null;
  return {
    query: tok,
    tier: "first-token",
    banner: `No exact matches for "${raw.trim()}" — showing projects related to "${tok}"`,
  };
}

/** Decide the next plan to run given how many results the previous tier
 *  produced. Threshold-driven so the page can iterate:
 *
 *    nextRelaxation(raw, total, lastTier) → null | RelaxedPlan
 *
 *  Caller starts with `lastTier="strict"` and a count from the strict
 *  pass; loops calling this until it returns null OR it has >= some
 *  satisfying total. */
export type RelaxationTier = "strict" | RelaxedPlan["tier"] | "exhausted";

export function nextRelaxation(
  raw: string,
  totalSoFar: number,
  lastTier: RelaxationTier,
): RelaxedPlan | null {
  // Stop relaxing when we already have plenty.
  if (totalSoFar >= 6 && lastTier !== "strict") return null;

  // Standard order. Each tier only fires once.
  switch (lastTier) {
    case "strict":
      return buildTokenPlan(raw)
        ?? buildFuzzySynonymPlan(raw)
        ?? buildDistinctivePlan(raw)
        ?? buildFirstTokenPlan(raw);
    case "tokens":
      if (totalSoFar >= 6) return null;
      return buildFuzzySynonymPlan(raw)
        ?? buildDistinctivePlan(raw)
        ?? buildFirstTokenPlan(raw);
    case "fuzzy-synonyms":
      if (totalSoFar >= 6) return null;
      return buildDistinctivePlan(raw) ?? buildFirstTokenPlan(raw);
    case "distinctive":
      if (totalSoFar >= 3) return null;
      return buildFirstTokenPlan(raw);
    case "first-token":
    case "exhausted":
      return null;
  }
}

/** Diagnostic helper: enumerate all the plans the resilience pipeline
 *  would attempt for `raw`, in order. Useful for tests + dev tools. */
export function planRelaxationChain(raw: string): RelaxedPlan[] {
  const plans: RelaxedPlan[] = [];
  let lastTier: RelaxationTier = "strict";
  // Pretend each tier returned 0 results so we walk the full chain.
  while (true) {
    const next = nextRelaxation(raw, 0, lastTier);
    if (!next) break;
    plans.push(next);
    lastTier = next.tier;
  }
  return plans;
}

/** Build the union of all expansion terms the resilience pipeline
 *  would surface for `raw`. Used by tests to assert "mouse tapper"
 *  expands to >= 3 distinct terms. */
export function relaxedExpansionTerms(raw: string): string[] {
  const seen = new Set<string>(significantTokens(raw));
  for (const plan of planRelaxationChain(raw)) {
    for (const tok of significantTokens(plan.query)) seen.add(tok);
  }
  // Also include the strict synonym expansion when it matches.
  const strict = expandQuery(raw);
  for (const t of strict.expandedTerms) seen.add(t.toLowerCase());
  return Array.from(seen);
}

// Re-export so consumers can import from one place.
export type { ExpandQueryResult };
