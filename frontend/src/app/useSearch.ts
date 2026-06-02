"use client";

// The search engine, extracted from the page god-component. Owns the
// result-domain state + the full search orchestration (key-term reduction →
// optional AI query understanding → parallel fan-out with streaming → BM25
// merge → relaxation chain → AI synthesis), the stale-while-revalidate result
// cache, the search history, and the per-run AbortController. The page passes
// the currently-selected sources and a `resetView` callback (so the search can
// reset the page's view state — sort/filter/tray/scroll — without owning it),
// and consumes the returned state by destructuring it into the same names the
// JSX already uses. Behaviour is identical to the previous inline version.

import { useCallback, useRef, useState } from "react";
import {
  searchAllSources,
  UnifiedProject,
  SourceType,
  mergeRelatedProjects,
  expandQuery,
  rankCorpus,
  buildSearchQuery,
  coreSearchQuery,
  significantTokens,
  nextRelaxation,
  type RelaxationTier,
  type RelaxedPlan,
} from "@/lib/sources";
import { parseQuery } from "@/lib/query-parser";
import { optimizeQuery, synthesizeResults } from "@/lib/api-client";
import { toast } from "sonner";

const HISTORY_KEY = "threadseeker:history:v1";
const HISTORY_MAX = 8;

// Per-tab cache of merged result sets so retyping a recent query or popping
// back via browser history returns instantly instead of re-running every
// source. Cap + TTL keep sessionStorage bounded.
const RESULTS_CACHE_PREFIX = "threadseeker:results:v1:";
const RESULTS_CACHE_TTL_MS = 10 * 60 * 1000;

function resultsCacheKey(query: string, sources: SourceType[]): string {
  const key = `${query.toLowerCase()}|${[...sources].sort().join(",")}`;
  return `${RESULTS_CACHE_PREFIX}${key}`;
}

function loadResultsCache(
  query: string,
  sources: SourceType[],
): UnifiedProject[] | null {
  try {
    const raw = sessionStorage.getItem(resultsCacheKey(query, sources));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.at !== "number" || !Array.isArray(parsed.data)) return null;
    if (Date.now() - parsed.at > RESULTS_CACHE_TTL_MS) return null;
    return parsed.data as UnifiedProject[];
  } catch {
    return null;
  }
}

function saveResultsCache(
  query: string,
  sources: SourceType[],
  data: UnifiedProject[],
) {
  try {
    sessionStorage.setItem(
      resultsCacheKey(query, sources),
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {
    /* quota — ignore */
  }
}

// Exported so the page's initial URL-load effect can seed history in the same
// order as before (load, then prepend any deep-linked query).
export function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function saveHistory(list: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch {
    /* quota, private mode — silently ignore */
  }
}

interface UseSearchArgs {
  /** Sources to query (the page's current selection). */
  selectedSources: SourceType[];
  /** Reset the page's view state on a new search. Called with preserveView. */
  resetView: (preserveView: boolean) => void;
}

export function useSearch({ selectedSources, resetView }: UseSearchArgs) {
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSources, setPendingSources] = useState(0);
  const [pendingSourceList, setPendingSourceList] = useState<SourceType[]>([]);
  const [failedSources, setFailedSources] = useState<SourceType[]>([]);
  const [lastSearchedCount, setLastSearchedCount] = useState(0);
  const [emptySources, setEmptySources] = useState<SourceType[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [query, setQuery] = useState("");
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [relaxationBanner, setRelaxationBanner] = useState<string | null>(null);
  const [relaxedQueries, setRelaxedQueries] = useState<string[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [synthLoading, setSynthLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const searchRunIdRef = useRef(0);
  // Aborts the in-flight search when a newer one supersedes it — cancels the
  // GitHub network calls (rate-sensitive) and lets the orchestrator stop
  // awaiting the rest, instead of letting abandoned fan-outs run to completion.
  const searchAbortRef = useRef<AbortController | null>(null);
  const lastSubmittedRef = useRef<string>("");

  const handleSearch = useCallback(
    async (searchQuery: string, preserveView: boolean = false) => {
      const q = searchQuery.trim();
      if (!q) return;
      lastSubmittedRef.current = q;

      const parsed = parseQuery(q);
      const freeText = parsed.freeText || q;

      searchRunIdRef.current += 1;
      const runId = searchRunIdRef.current;
      const startedAt = performance.now();

      // Cancel the previous in-flight search before starting this one.
      searchAbortRef.current?.abort();
      const abortController = new AbortController();
      searchAbortRef.current = abortController;
      const signal = abortController.signal;

      setQuery(q);
      setProjects([]);
      setIsLoading(true);
      setSearchDurationMs(null);
      // Reset the page's view state (scroll-to-top, clear sort/filter unless
      // preserving, close the failed-source tray). Owned by the page.
      resetView(preserveView);

      const targetSources = parsed.source && (selectedSources as string[]).includes(parsed.source)
        ? [parsed.source]
        : selectedSources;
      setPendingSources(targetSources.length);
      setPendingSourceList(targetSources);
      setFailedSources([]);
      setEmptySources([]);
      setLastSearchedCount(targetSources.length);
      setHasSearched(true);

      // Stale-while-revalidate: if this exact query + source set was searched
      // in the last few minutes, paint the cached results immediately (no
      // skeleton flash) while the live search below refreshes them.
      const cachedResults = loadResultsCache(freeText, targetSources);
      if (cachedResults && cachedResults.length > 0) {
        setProjects(cachedResults);
      }

      setHistory((prev) => {
        const next = [q, ...prev.filter((h) => h !== q)].slice(0, HISTORY_MAX);
        saveHistory(next);
        return next;
      });

      // Reset relaxation + AI-verdict state at the start of every search.
      setRelaxationBanner(null);
      setRelaxedQueries([]);
      setSynthesis(null);
      setSynthLoading(false);

      try {
        const expansion = expandQuery(freeText);
        // Long natural-language queries are reduced to their key content terms
        // for the upstream fetch (upstream APIs AND-match and return nothing on
        // a 30-token paragraph). The FULL freeText still drives BM25 re-ranking
        // below, so a specific paragraph both *returns* results and *ranks*
        // them by the full intent. Short queries are unchanged.
        let fetchQuery = coreSearchQuery(freeText);
        // For long queries, let the optional AI layer distill key terms — a
        // better reduction than the deterministic one. Capped at 1.5s and
        // falls back to fetchQuery when the layer is disabled / slow / absent,
        // so search stays fast and never breaks without a key.
        if (significantTokens(freeText).length > 7) {
          const ai = await Promise.race([
            optimizeQuery(freeText),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
          ]);
          if (searchRunIdRef.current !== runId) return;
          if (ai && ai.keyTerms.length > 0) {
            fetchQuery = ai.keyTerms.join(" ");
          }
        }
        const hueByIntent: Record<string, number> = {
          project_search: 220,
          how_to: 150,
          recommendation: 200,
          comparison: 240,
          troubleshooting: 350,
          model_search: 40,
          general: 220,
        };
        if (typeof document !== "undefined") {
          document.documentElement.style.setProperty("--ts-intent-hue", String(hueByIntent[expansion.intent] ?? 220));
        }
        const overrides: Partial<Record<SourceType, string>> = {};
        const orExpanded = buildSearchQuery(fetchQuery, expansion, { supportsOr: true });
        if (orExpanded !== fetchQuery) {
          // ONLY GitHub parses boolean `OR` + quoted phrases. GitLab and
          // Codeberg treat the operators as literal required substrings, which
          // collapses recall catastrophically (verified live: GitLab 708 -> 7,
          // Codeberg -> 0), so they keep the plain fetchQuery.
          overrides.github = orExpanded;
        }

        const results = await searchAllSources(
          fetchQuery,
          targetSources,
          true,
          overrides,
          (event) => {
            if (searchRunIdRef.current !== runId) return;
            setPendingSources(event.remaining);
            setPendingSourceList((prev) => prev.filter((s) => s !== event.source));
            if (event.error) {
              setFailedSources((prev) =>
                prev.includes(event.source) ? prev : [...prev, event.source],
              );
            } else if (event.projects.length === 0) {
              setEmptySources((prev) =>
                prev.includes(event.source) ? prev : [...prev, event.source],
              );
            }
            if (event.projects.length > 0) {
              setProjects((prev) => {
                const seen = new Set(prev.map((p) => p.id));
                const merged = prev.slice();
                for (const p of event.projects) {
                  if (!seen.has(p.id)) {
                    seen.add(p.id);
                    merged.push(p);
                  }
                }
                return merged;
              });
            }
          },
          signal,
        );

        if (searchRunIdRef.current !== runId) return;
        const mergedCorpus: UnifiedProject[] = results;
        const ranked = rankCorpus(mergeRelatedProjects(mergedCorpus), freeText, expansion);
        setProjects(ranked);
        // Cache the fresh ranked set so a quick re-search (or history click)
        // repaints instantly via the stale-while-revalidate seed above.
        saveResultsCache(freeText, targetSources, ranked);
        // Track the final displayed set so the AI verdict (fired after the
        // relaxation loop below) summarizes what the user actually ends up
        // seeing — not a stale strict-pass top-10.
        let finalRanked = ranked;

        // Resilience loop. If the strict pass came back thin, walk the
        // relaxation chain (tokens → fuzzy-synonyms → distinctive →
        // first-token) until we have enough results or the chain is exhausted.
        const SATISFIED_AT = 9;
        if (ranked.length < SATISFIED_AT) {
          const seenIds = new Set(mergedCorpus.map((p) => p.id));
          const relaxedQueriesRun: string[] = [];
          let firstBanner: string | null = null;
          let lastTier: RelaxationTier = "strict";
          let cumulative = ranked.length;
          for (let step = 0; step < 4; step += 1) {
            const plan: RelaxedPlan | null = nextRelaxation(freeText, cumulative, lastTier);
            if (!plan) break;
            if (plan.query.trim().toLowerCase() === freeText.trim().toLowerCase()) {
              lastTier = plan.tier;
              continue;
            }
            if (relaxedQueriesRun.includes(plan.query)) {
              lastTier = plan.tier;
              continue;
            }
            relaxedQueriesRun.push(plan.query);
            firstBanner = firstBanner ?? plan.banner;

            const relaxedExpansion = expandQuery(plan.query);
            const relaxedOverrides: Partial<Record<SourceType, string>> = {};
            const relaxedOr = buildSearchQuery(plan.query, relaxedExpansion, { supportsOr: true });
            if (relaxedOr !== plan.query) {
              // GitHub only — see the OR-syntax note on the primary fetch above.
              relaxedOverrides.github = relaxedOr;
            }

            const relaxedResults = await searchAllSources(
              plan.query,
              targetSources,
              true,
              relaxedOverrides,
              undefined,
              signal,
            );
            if (searchRunIdRef.current !== runId) return;

            for (const p of relaxedResults) {
              if (!seenIds.has(p.id)) {
                seenIds.add(p.id);
                mergedCorpus.push(p);
              }
            }
            const reranked = rankCorpus(
              mergeRelatedProjects(mergedCorpus),
              freeText,
              expansion,
            );
            setProjects(reranked);
            finalRanked = reranked;
            cumulative = reranked.length;
            lastTier = plan.tier;
            if (cumulative >= SATISFIED_AT) break;
          }

          if (relaxedQueriesRun.length > 0) {
            setRelaxedQueries(relaxedQueriesRun);
            setRelaxationBanner(firstBanner);
          }
        }

        // AI verdict — async, never blocks. Fired on the FINAL displayed set
        // (after any relaxation) so it summarizes what the user actually sees.
        // Renders only when the AI layer is active (a key is set).
        if (finalRanked.length > 0) {
          setSynthLoading(true);
          synthesizeResults(
            freeText,
            finalRanked.slice(0, 10).map((p) => ({
              name: p.name,
              source: p.source,
              description: p.description,
              stars: p.stars,
            })),
          )
            .then((v) => {
              if (searchRunIdRef.current !== runId) return;
              setSynthesis(v);
              setSynthLoading(false);
            })
            .catch(() => {
              if (searchRunIdRef.current === runId) setSynthLoading(false);
            });
        }
      } catch (error) {
        if (searchRunIdRef.current !== runId) return;
        toast.error("Search failed. Please try again.");
        console.error(error);
      } finally {
        if (searchRunIdRef.current === runId) {
          setIsLoading(false);
          setPendingSources(0);
          setPendingSourceList([]);
          setSearchDurationMs(Math.round(performance.now() - startedAt));
        }
      }
    },
    [selectedSources, resetView],
  );

  // Resets the search domain only. The page's handleClear wraps this with its
  // own view resets + URL replaceState.
  const clearSearch = useCallback(() => {
    searchRunIdRef.current += 1;
    searchAbortRef.current?.abort();
    setQuery("");
    setProjects([]);
    setIsLoading(false);
    setPendingSources(0);
    setPendingSourceList([]);
    setFailedSources([]);
    setEmptySources([]);
    setHasSearched(false);
    setSynthesis(null);
    setSynthLoading(false);
    lastSubmittedRef.current = "";
  }, []);

  const debouncedChangeHandler = useCallback(
    (v: string) => {
      const trimmed = v.trim();
      if (!trimmed) return;
      if (trimmed === lastSubmittedRef.current) return;
      handleSearch(trimmed);
    },
    [handleSearch],
  );

  const handleHistoryRemove = useCallback((q: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== q);
      saveHistory(next);
      return next;
    });
  }, []);

  return {
    // result-domain state
    projects,
    isLoading,
    pendingSources,
    pendingSourceList,
    failedSources,
    lastSearchedCount,
    emptySources,
    hasSearched,
    query,
    searchDurationMs,
    relaxationBanner,
    relaxedQueries,
    synthesis,
    synthLoading,
    history,
    setHistory,
    // refs the page/JSX reference
    lastSubmittedRef,
    // actions
    handleSearch,
    clearSearch,
    debouncedChangeHandler,
    handleHistoryRemove,
  };
}
