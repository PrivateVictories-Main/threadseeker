// SEO landing routes (/search/[slug]) — the data layer.
//
// The app is a single statically-exported client shell, which means Google
// sees exactly ONE indexable URL. These helpers derive a curated set of
// real, useful landing slugs from the suggestion corpus (the queries the
// deterministic engine is known to handle well), so the static export grows
// from 1 indexable page to ~50 unique ones. Kept in /lib (not in the route
// dir) because both the route AND sitemap.ts consume it — single source of
// truth, no drift between what's exported and what's in the sitemap.
//
// Server-safe by construction: pure data + string functions, no React, no
// browser APIs — importable from generateStaticParams/generateMetadata.

import { CURATED_QUERIES } from "@/lib/suggestions";

export interface SeoLanding {
  /** URL-safe slug, e.g. "react-state-management". */
  slug: string;
  /** The human query the slug stands for, e.g. "react state management". */
  query: string;
}

/**
 * Slugify a curated query: lowercase, collapse anything non-alphanumeric to
 * single hyphens, trim edge hyphens. "end-to-end testing framework" →
 * "end-to-end-testing-framework". Deliberately simple — the corpus is
 * hand-picked ASCII, so no unicode-normalization machinery is needed.
 */
export function slugifyQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Derived (not hand-maintained) from the suggestion corpus so a new curated
// query automatically becomes a landing page on the next build. De-duped by
// slug defensively — two queries that collapse to the same slug would
// otherwise make generateStaticParams emit a duplicate route.
export const SEO_LANDINGS: SeoLanding[] = (() => {
  const seen = new Set<string>();
  const out: SeoLanding[] = [];
  for (const query of CURATED_QUERIES) {
    const slug = slugifyQuery(query);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, query });
  }
  return out;
})();

const BY_SLUG = new Map(SEO_LANDINGS.map((l) => [l.slug, l]));

/** Look up a landing by slug. Undefined for anything outside the corpus. */
export function getLandingBySlug(slug: string): SeoLanding | undefined {
  return BY_SLUG.get(slug);
}

// Generic tail words ("library", "framework", …) appear across unrelated
// queries, so a match on one is a weak relatedness signal; a match on a
// specific head word ("react", "llm", "kafka") is a strong one. Scoring
// them 1 vs 2 keeps "data visualization library" closer to "web scraping
// library" than to "vector database", but closer still to nothing that
// shares a specific term.
const GENERIC_TOKENS = new Set([
  "library",
  "framework",
  "tool",
  "tooling",
  "app",
  "client",
  "engine",
  "model",
  "alternative",
  "manager",
  "to",
  "end",
]);

/**
 * Pick `limit` related landings for a slug — internal-linking fuel for the
 * static pages (every landing links to a handful of sibling landings, so
 * crawlers can walk the whole corpus from any entry point).
 *
 * Ranking: token-overlap score (specific words count double), corpus order
 * as the tiebreak, then corpus-order fill so sparse-overlap queries still
 * get a full row of links. Fully deterministic — the same build always
 * emits the same HTML.
 */
export function getRelatedLandings(slug: string, limit = 6): SeoLanding[] {
  const self = BY_SLUG.get(slug);
  if (!self) return SEO_LANDINGS.slice(0, limit);

  const selfTokens = new Set(self.slug.split("-"));
  const scored = SEO_LANDINGS.filter((l) => l.slug !== slug).map((l, i) => {
    let score = 0;
    for (const t of l.slug.split("-")) {
      if (!selfTokens.has(t)) continue;
      score += GENERIC_TOKENS.has(t) ? 1 : 2;
    }
    return { landing: l, score, order: i };
  });

  scored.sort((a, b) => b.score - a.score || a.order - b.order);

  const out: SeoLanding[] = [];
  for (const { landing, score } of scored) {
    if (out.length >= limit) break;
    if (score > 0) out.push(landing);
  }
  // Fill from corpus order (skipping self + already-picked) when token
  // overlap alone can't produce `limit` entries.
  for (const { landing } of scored) {
    if (out.length >= limit) break;
    if (!out.includes(landing)) out.push(landing);
  }
  return out;
}

/**
 * Per-landing meta description. Template-built but genuinely unique per
 * slug: the query itself plus its two nearest related queries are baked in,
 * so no two landings share a description (Search Console flags duplicated
 * descriptions across a page set).
 */
export function landingDescription(
  landing: SeoLanding,
  sourceCount: number,
): string {
  const related = getRelatedLandings(landing.slug, 2)
    .map((l) => l.query)
    .join(", ");
  return (
    `Compare the best open-source ${landing.query} projects — live results ` +
    `from ${sourceCount} platforms including GitHub, npm, PyPI, crates.io, ` +
    `Hugging Face, and Docker Hub, ranked by stars, downloads, and ` +
    `community signal. Free, no account. Related: ${related}.`
  );
}
