"use client";

// Iter-25 / Major Overhaul K — Track 2.
//
// "Discover more" rail that fills the empty space on a sparse search-
// results page. Sections (any of which may be hidden if data is empty):
//
//   1. "Did you mean?" — chip surfacing the first relaxed query the
//      resilience pipeline executed.
//   2. Related queries — 4-6 chips of related searches drawn from
//      synonym entries that fuzzy-matched the user's query, plus a
//      hardcoded fallback list for "no synonym hit at all".
//   3. Browse by tag — when the matched synonym entries had topics,
//      surface them as one-click chips.
//   4. (Trending row + last-resort GitHub fallback are owned by the
//      caller — page.tsx already renders FeaturedProjects / "More from"
//      so this rail focuses on the chip-style rails.)
//
// Design intent: avoid the "tiny SearchX icon + huge whitespace" empty
// state. The rail puts useful content in the user's path so even a
// zero-result query produces a visually-dense, actionable page.

import { ArrowRight, Sparkles, Tag, Lightbulb } from "lucide-react";
import { SYNONYMS } from "@/lib/sources/synonyms";
import { significantTokens } from "@/lib/sources/resilience";

interface Props {
  /** The user's most recent search query, raw. */
  query: string;
  /** Banner string from the resilience pipeline (if it fired). */
  banner: string | null;
  /** The relaxed queries the resilience pipeline actually executed. */
  relaxedQueries: string[];
  /** Fired when a chip is clicked. The page re-runs handleSearch with this query. */
  onQueryClick: (q: string) => void;
  /** Whether to render the heavy "Discover more" header (false for the
   *  inline footer variant on dense pages). */
  variant: "full" | "footer";
}

/** Heuristic: drop synonym entries whose triggers + expandTo share at
 *  least one token with the user's query. Returns [...entries] sorted
 *  by match-score (desc). */
function findRelevantSynonyms(query: string) {
  const userTokens = significantTokens(query);
  if (userTokens.length === 0) return [];

  const scored: Array<{ entry: (typeof SYNONYMS)[number]; score: number }> = [];
  for (const entry of SYNONYMS) {
    let score = 0;
    for (const trig of entry.triggers) {
      const tt = trig.toLowerCase();
      for (const ut of userTokens) {
        if (tt.includes(ut) && ut.length >= 3) score += 2;
        if (ut.includes(tt) && tt.length >= 3) score += 2;
      }
    }
    for (const target of entry.expandTo) {
      const tt = target.toLowerCase();
      for (const ut of userTokens) {
        if (tt.includes(ut) && ut.length >= 3) score += 1;
        if (ut.includes(tt) && tt.length >= 3) score += 1;
      }
    }
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.entry);
}

/** Hardcoded "popular searches" fallback for queries that don't match
 *  any synonym at all. Mixed across categories so the rail still
 *  surfaces value. */
const POPULAR_FALLBACK_QUERIES = [
  "self hosted",
  "obsidian alt",
  "rust cli",
  "python web framework",
  "react state management",
  "code editor",
  "screenshot tool",
  "rss reader",
];

export function DiscoverRail({
  query,
  banner,
  relaxedQueries,
  onQueryClick,
  variant,
}: Props) {
  const synonymHits = findRelevantSynonyms(query);

  // Derive related-query chips:
  // 1. first the relaxed queries the resilience pipeline ran (most
  //    actionable — clicking them takes the user to the same broadened
  //    result set with the chip's text in the search bar)
  // 2. then the trigger-strings from matched synonym entries
  // 3. fallback to the popular list when nothing else came in
  const relatedSet = new Set<string>();
  const lowerQuery = query.trim().toLowerCase();
  for (const r of relaxedQueries) {
    if (r.toLowerCase() !== lowerQuery) relatedSet.add(r);
  }
  for (const entry of synonymHits) {
    for (const trig of entry.triggers) {
      if (trig.toLowerCase() !== lowerQuery && relatedSet.size < 8) {
        relatedSet.add(trig);
      }
    }
    if (relatedSet.size >= 8) break;
  }
  if (relatedSet.size === 0) {
    for (const q of POPULAR_FALLBACK_QUERIES) relatedSet.add(q);
  }
  const relatedQueries = Array.from(relatedSet).slice(0, 8);

  // First relaxed query as the "did you mean" suggestion.
  const didYouMean = relaxedQueries[0] ?? null;

  // Topic chips drawn from synonym hits. Pulls expandTo terms — these
  // are the "real project / tech name" terms the matched synonym groups
  // pointed at (e.g. "xdotool", "autohotkey").
  const topicSet = new Set<string>();
  for (const entry of synonymHits) {
    for (const t of entry.expandTo) {
      if (t.toLowerCase() !== lowerQuery && topicSet.size < 8) {
        topicSet.add(t);
      }
    }
    if (topicSet.size >= 8) break;
  }
  const topicChips = Array.from(topicSet);

  if (variant === "footer") {
    // Compact inline strip — only the related-queries row, no header.
    return (
      <div className="ts-discover-footer" role="region" aria-label="Related searches">
        <span className="ts-discover-footer-label">{"// Related"}</span>
        {relatedQueries.slice(0, 6).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onQueryClick(q)}
            className="ts-discover-chip"
            title={`Search for ${q}`}
          >
            {q}
          </button>
        ))}
      </div>
    );
  }

  return (
    <section
      className="ts-discover-rail"
      aria-labelledby="ts-discover-head"
    >
      <div className="ts-discover-head">
        <h2 id="ts-discover-head" className="ts-section-header">
          <Sparkles className="inline-block w-3 h-3 mr-1" aria-hidden />
          {"// Discover more"}
        </h2>
        {banner && (
          <p className="ts-discover-banner" role="note">
            {banner}
          </p>
        )}
      </div>

      {/* "Did you mean?" prominent chip — appears when the resilience
          pipeline executed at least one relaxed query. */}
      {didYouMean && (
        <div className="ts-discover-section">
          <span className="ts-discover-label">
            <Lightbulb className="inline-block w-3 h-3 mr-1" aria-hidden />
            Did you mean
          </span>
          <button
            type="button"
            onClick={() => onQueryClick(didYouMean)}
            className="ts-discover-chip is-primary"
          >
            {didYouMean}
            <ArrowRight className="w-3 h-3 ml-1" aria-hidden />
          </button>
        </div>
      )}

      {/* Related queries — 4-8 chips. */}
      {relatedQueries.length > 0 && (
        <div className="ts-discover-section">
          <span className="ts-discover-label">Related searches</span>
          <div className="ts-discover-chips">
            {relatedQueries.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onQueryClick(q)}
                className="ts-discover-chip"
                title={`Search for ${q}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Browse by tag — surfaced when synonym hits had concrete
          tech-name expansions. */}
      {topicChips.length > 0 && (
        <div className="ts-discover-section">
          <span className="ts-discover-label">
            <Tag className="inline-block w-3 h-3 mr-1" aria-hidden />
            Browse by tool
          </span>
          <div className="ts-discover-chips">
            {topicChips.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onQueryClick(t)}
                className="ts-discover-chip is-tag"
                title={`Search for ${t}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
