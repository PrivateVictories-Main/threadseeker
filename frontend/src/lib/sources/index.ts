// Public entry point for the unified source layer. Everything downstream
// (page.tsx, cards, toolbars, saved section) imports from `@/lib/sources`
// and should never need to know about the file split behind this barrel.
//
// Split rationale:
//   types.ts         — shapes every other layer depends on
//   registry.ts      — per-source display config + native search URLs
//   ranking-bm25.ts  — the single cross-source relevance score (BM25 + synonyms)
//   synonyms.ts      — query expansion driving the BM25 ranker
//   merge.ts         — cross-platform de-duplication
//   adapters.ts      — one function per upstream API
//   index.ts         — this file; re-exports + the orchestrator

import { UnifiedProject, SearchResult, SearchProgressCallback, SourceType } from "./types";
import { significantTokens } from "./resilience";
import {
  searchGitHub,
  searchHuggingFace,
  searchGitLab,
  searchNpm,
  searchPyPI,
  searchCrates,
  searchHackerNews,
  searchCodeberg,
  searchPackagist,
  searchRubyGems,
  searchReddit,
  searchDockerHub,
  searchJSR,
  searchFlathub,
  searchDevTo,
  searchLobsters,
  searchStackOverflow,
  searchPapersWithCode,
  searchHomebrew,
  searchFDroid,
  searchArxiv,
  searchAUR,
  searchOpenVsx,
  searchCondaForge,
  searchNuGet,
  searchZenodo,
  searchWordPress,
  searchMaven,
  searchHex,
} from "./adapters";

export * from "./types";
export * from "./registry";
export { rankCorpus } from "./ranking-bm25";
export { expandQuery } from "./synonyms";
export type { ExpandQueryResult } from "./synonyms";
export * from "./merge";
export * from "./adapters";
export {
  significantTokens,
  extractKeyTerms,
  coreSearchQuery,
  pickDistinctiveToken,
  pickFirstToken,
  buildTokenPlan,
  buildDistinctivePlan,
  buildFuzzySynonymPlan,
  buildFirstTokenPlan,
  nextRelaxation,
  planRelaxationChain,
  relaxedExpansionTerms,
} from "./resilience";
export type { RelaxedPlan, RelaxationTier } from "./resilience";

// Default set. Explicitly ordered so that when callers don't pass a subset,
// the first few sources to complete are the high-signal ones (repo hosts
// and major package registries). Changing this order changes the "first
// tiles you see while the slower sources are still loading" experience.
const DEFAULT_SOURCES: SourceType[] = [
  "github",
  "huggingface",
  "gitlab",
  "npm",
  "pypi",
  "crates",
  "hackernews",
  "codeberg",
  "packagist",
  "rubygems",
  "reddit",
  "dockerhub",
  "jsr",
  "flathub",
  "devto",
  "lobsters",
  "stackoverflow",
  "paperswithcode",
  "homebrew",
  "fdroid",
  "arxiv",
  "aur",
  "openvsx",
  "conda",
  "zenodo",
  "nuget",
  "wordpress",
  "maven",
  "hex",
];

// If a source hasn't returned in this long we drop it for this run. One
// slow upstream should not stall the "N sources remaining" UI counter.
const PER_SOURCE_TIMEOUT_MS = 12_000;

export async function searchAllSources(
  query: string,
  sources: SourceType[] = DEFAULT_SOURCES,
  deepSearch: boolean = true,
  queryOverrides: Partial<Record<SourceType, string>> = {},
  onProgress?: SearchProgressCallback,
  signal?: AbortSignal,
): Promise<UnifiedProject[]> {
  const q = (source: SourceType) => queryOverrides[source] || query;
  let remaining = sources.length;

  const withTimeout = async <T>(
    label: SourceType,
    work: () => Promise<T>,
  ): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out`)),
        PER_SOURCE_TIMEOUT_MS,
      ),
    );
    // When a newer search supersedes this run, stop awaiting this source
    // immediately (its result would be discarded anyway by the caller's
    // run-id guard). The GitHub path additionally cancels its network call.
    const aborted = new Promise<never>((_, reject) => {
      if (!signal) return;
      if (signal.aborted) {
        reject(new Error(`${label} aborted`));
      } else {
        signal.addEventListener("abort", () => reject(new Error(`${label} aborted`)), {
          once: true,
        });
      }
    });
    return Promise.race([work(), timeout, aborted]);
  };

  const runSource = async (source: SourceType): Promise<SearchResult> => {
    switch (source) {
      case "github":
        return searchGitHub(q("github"), 1, deepSearch, signal);
      case "huggingface":
        return searchHuggingFace(q("huggingface"), 1, deepSearch);
      case "gitlab":
        return searchGitLab(q("gitlab"), 1, deepSearch);
      case "npm":
        return searchNpm(q("npm"), deepSearch);
      case "pypi":
        return searchPyPI(q("pypi"), deepSearch);
      case "crates":
        return searchCrates(q("crates"));
      case "hackernews":
        return searchHackerNews(q("hackernews"));
      case "codeberg":
        return searchCodeberg(q("codeberg"));
      case "packagist":
        return searchPackagist(q("packagist"));
      case "rubygems":
        return searchRubyGems(q("rubygems"));
      case "reddit":
        return searchReddit(q("reddit"));
      case "dockerhub":
        return searchDockerHub(q("dockerhub"));
      case "jsr":
        return searchJSR(q("jsr"));
      case "flathub":
        return searchFlathub(q("flathub"));
      case "devto":
        return searchDevTo(q("devto"));
      case "lobsters":
        return searchLobsters(q("lobsters"));
      case "stackoverflow":
        return searchStackOverflow(q("stackoverflow"));
      case "paperswithcode":
        return searchPapersWithCode(q("paperswithcode"));
      case "homebrew":
        return searchHomebrew(q("homebrew"));
      case "fdroid":
        return searchFDroid(q("fdroid"));
      case "arxiv":
        return searchArxiv(q("arxiv"));
      case "aur":
        return searchAUR(q("aur"));
      case "openvsx":
        return searchOpenVsx(q("openvsx"));
      case "conda":
        return searchCondaForge(q("conda"));
      case "nuget":
        return searchNuGet(q("nuget"));
      case "zenodo":
        return searchZenodo(q("zenodo"));
      case "wordpress":
        return searchWordPress(q("wordpress"));
      case "maven":
        return searchMaven(q("maven"));
      case "hex":
        return searchHex(q("hex"));
      default:
        return { projects: [], totalCount: 0, source };
    }
  };

  const searchPromises = sources.map(async (source) => {
    let result: SearchResult;
    try {
      result = await withTimeout(source, () => runSource(source));
    } catch (error) {
      console.error(`Error searching ${source}:`, error);
      const message =
        error instanceof Error ? error.message : "Unknown error";
      result = { projects: [], totalCount: 0, source, error: message };
    }

    remaining -= 1;
    if (onProgress) {
      // Streaming partials arrive in the upstream API's native order. The
      // consumer (page.tsx) re-ranks the merged corpus authoritatively via
      // rankCorpus() once all sources have returned, so a per-source sort
      // here would just be thrown away.
      onProgress({
        source,
        projects: result.projects,
        done: remaining === 0,
        remaining,
        error: result.error,
      });
    }
    return result;
  });

  const results = await Promise.all(searchPromises);
  const allProjects = results.flatMap((r) => r.projects);

  // Intentionally unsorted — final ranking is rankCorpus() in the caller.
  return allProjects;
}

import type { ExpandQueryResult } from "./synonyms";

/**
 * For sources that support OR operators in their search query (GitHub, npm),
 * build a single composite query string. Falls back to raw user query for
 * APIs that don't support ORs.
 */
export function buildSearchQuery(
  rawQuery: string,
  expansion: ExpandQueryResult,
  opts: { supportsOr: boolean },
): string {
  if (!opts.supportsOr) return rawQuery;
  // OR-join the query's own content tokens with the curated synonym
  // expansions (canonical lib/project names). Deliberately uses
  // significantTokens(rawQuery) + synonymTerms rather than the raw
  // expandedTerms: for a reduced long query that keeps the OR query focused
  // on real content terms instead of dragging in paragraph filler.
  const base = significantTokens(rawQuery);
  const extras = expansion.synonymTerms.filter((t) => !base.includes(t));
  const terms = [...base, ...extras].slice(0, 6);
  if (terms.length <= 1) return rawQuery;
  // GitHub-style: `term1 OR term2 OR "two words"`
  return terms.map((t) => (t.includes(" ") ? `"${t}"` : t)).join(" OR ");
}
