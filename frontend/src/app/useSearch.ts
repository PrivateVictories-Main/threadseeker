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

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  UnifiedProject,
  SourceType,
} from "@/lib/sources/types";
import type { RelaxationTier, RelaxedPlan } from "@/lib/sources/resilience";
import { parseQuery } from "@/lib/query-parser";
import { optimizeQuery, synthesizeResults, rerankResults } from "@/lib/api-client";
import { toast } from "sonner";

// The search ENGINE (30 adapters + the 868-line synonym dictionary + BM25 +
// the relaxation pipeline) is ~the heaviest code in the app and none of it is
// needed to paint the landing page — so it loads as its own chunk. The module
// system caches the import, so every call after the first is synchronous-
// fast; loadEngine() is also fired on idle right after mount, so in practice
// the chunk is resident before a human can type a query.
type Engine = typeof import("@/lib/sources");
let enginePromise: Promise<Engine> | null = null;
function loadEngine(): Promise<Engine> {
  enginePromise ??= import("@/lib/sources");
  return enginePromise;
}

const HISTORY_KEY = "threadseeker:history:v1";
const HISTORY_MAX = 8;

// Valid intent labels the AI layer may return (mirrors the Intent union) — used
// to validate ai.intent before letting it override the regex classifier.
const AI_INTENTS = new Set([
  "project_search", "how_to", "recommendation", "comparison",
  "troubleshooting", "model_search", "general",
]);

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

// Real eviction (the cap used to be aspirational): keep at most this many
// cached result sets, dropping the oldest, so instant-repaint keeps working
// through a long session instead of silently dying at the storage quota.
const RESULTS_CACHE_MAX_ENTRIES = 20;

function evictOldestResults(keepNewest: number) {
  try {
    const ours: Array<{ key: string; at: number }> = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(RESULTS_CACHE_PREFIX)) continue;
      let at = 0;
      try {
        at = JSON.parse(sessionStorage.getItem(key) || "{}").at ?? 0;
      } catch {
        /* unparseable entry → treat as oldest */
      }
      ours.push({ key, at });
    }
    if (ours.length <= keepNewest) return;
    ours.sort((a, b) => b.at - a.at);
    for (const { key } of ours.slice(keepNewest)) sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable — nothing to evict */
  }
}

function saveResultsCache(
  query: string,
  sources: SourceType[],
  data: UnifiedProject[],
) {
  try {
    evictOldestResults(RESULTS_CACHE_MAX_ENTRIES - 1);
    sessionStorage.setItem(
      resultsCacheKey(query, sources),
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {
    // Quota even after the count cap (huge corpora): drop ALL our entries and
    // retry once — a fresh cache beats a dead one.
    try {
      evictOldestResults(0);
      sessionStorage.setItem(
        resultsCacheKey(query, sources),
        JSON.stringify({ at: Date.now(), data }),
      );
    } catch {
      /* storage genuinely unavailable — skip caching */
    }
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
  // Keyless in-browser semantic rerank lifecycle, surfaced so the UI can show
  // a tasteful "deep match" indicator: idle → scoring → applied|unavailable.
  const [semanticState, setSemanticState] = useState<
    "idle" | "scoring" | "applied" | "unavailable"
  >("idle");

  const searchRunIdRef = useRef(0);
  // Aborts the in-flight search when a newer one supersedes it — cancels the
  // GitHub network calls (rate-sensitive) and lets the orchestrator stop
  // awaiting the rest, instead of letting abandoned fan-outs run to completion.
  const searchAbortRef = useRef<AbortController | null>(null);
  const lastSubmittedRef = useRef<string>("");

  // Warm the engine chunk during idle time after mount — the landing paints
  // without it, but it should be resident before the first keystroke lands.
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const handle = w.requestIdleCallback
      ? w.requestIdleCallback(() => void loadEngine().catch(() => {}), { timeout: 2000 })
      : window.setTimeout(() => void loadEngine().catch(() => {}), 350);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
  }, []);

  const handleSearch = useCallback(
    async (searchQuery: string, preserveView: boolean = false) => {
      const q = searchQuery.trim();
      if (!q) return;
      lastSubmittedRef.current = q;

      // Engine chunk — usually already resident (idle prefetch above); on a
      // cold cache this awaits the one-time chunk fetch before the fan-out.
      const {
        searchAllSources,
        mergeRelatedProjects,
        expandQuery,
        rankCorpus,
        blendRerank,
        blendSemantic,
        semanticWeight,
        buildSearchQuery,
        coreSearchQuery,
        significantTokens,
        nextRelaxation,
      } = await loadEngine();

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

      // Reset relaxation + AI-verdict + semantic state at the start of every
      // search.
      setRelaxationBanner(null);
      setRelaxedQueries([]);
      setSynthesis(null);
      setSynthLoading(false);
      setSemanticState("idle");

      try {
        const expansion = expandQuery(freeText);
        // Long natural-language queries are reduced to their key content terms
        // for the upstream fetch (upstream APIs AND-match and return nothing on
        // a 30-token paragraph). The FULL freeText still drives BM25 + semantic
        // re-ranking below, so a specific paragraph both *returns* results and
        // *ranks* them by the full intent. Short queries are unchanged.
        const fetchQuery = coreSearchQuery(freeText);
        // The optional AI layer distills key terms + intent for long queries.
        // Fired CONCURRENTLY with the fan-out (it used to serially block the
        // flagship paragraph path for up to 1.5s): the deterministic fetch
        // starts immediately, and by the time the fan-out settles the AI
        // answer is either ready (consumed below as a supplemental fetch +
        // intent override) or it's discarded. Keyless deploys resolve null
        // instantly — zero cost.
        const longQuery = significantTokens(freeText).length > 7;
        const aiPromise: Promise<Awaited<ReturnType<typeof optimizeQuery>> | null> =
          longQuery
            ? Promise.race([
                optimizeQuery(freeText).catch(() => null),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
              ])
            : Promise.resolve(null);

        const hueByIntent: Record<string, number> = {
          project_search: 220,
          how_to: 150,
          recommendation: 200,
          comparison: 240,
          troubleshooting: 350,
          model_search: 40,
          general: 220,
        };
        const applyHue = () => {
          if (typeof document !== "undefined") {
            document.documentElement.style.setProperty(
              "--ts-intent-hue",
              String(hueByIntent[expansion.intent] ?? 220),
            );
          }
        };
        applyHue();
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

        // Consume the (concurrent) AI distillation now that the fan-out is
        // done — it has had the whole fetch window to resolve. A valid intent
        // re-tints ranking weights + the accent hue; key terms that genuinely
        // differ from the deterministic reduction earn ONE supplemental fetch
        // whose new results join the corpus before ranking.
        const ai = longQuery ? await aiPromise : null;
        if (searchRunIdRef.current !== runId) return;
        if (ai && AI_INTENTS.has(ai.intent)) {
          expansion.intent = ai.intent as typeof expansion.intent;
          applyHue();
        }
        if (ai && ai.keyTerms.length > 0) {
          const aiQuery = ai.keyTerms.join(" ").trim();
          if (
            aiQuery &&
            aiQuery.toLowerCase() !== fetchQuery.toLowerCase() &&
            aiQuery.toLowerCase() !== freeText.toLowerCase()
          ) {
            try {
              const aiResults = await searchAllSources(
                aiQuery,
                targetSources,
                true,
                {},
                undefined,
                signal,
              );
              if (searchRunIdRef.current !== runId) return;
              const seen = new Set(mergedCorpus.map((p) => p.id));
              for (const p of aiResults) {
                if (!seen.has(p.id)) {
                  seen.add(p.id);
                  mergedCorpus.push(p);
                }
              }
            } catch {
              /* supplemental fetch is best-effort */
            }
          }
        }

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
            // Skip plans that match what was ALREADY fetched — both the raw
            // query and the reduced core query the strict pass actually sent
            // (for long queries those differ, and re-running the fetch query
            // as a "relaxation" burns a full fan-out for zero new results).
            const planLc = plan.query.trim().toLowerCase();
            if (
              planLc === freeText.trim().toLowerCase() ||
              planLc === fetchQuery.trim().toLowerCase()
            ) {
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

        // SEMANTIC rerank — the keyless, free-for-everyone meaning pass. A
        // small retrieval-trained embedding model runs in a Web Worker (in
        // the user's browser; downloads once, then cached) and re-orders the
        // head of the corpus by cosine similarity to the FULL query text.
        // This is what makes "describe it in two or three sentences" actually
        // fine-tune results without any AI API or key. Async + run-id guarded
        // like the AI rerank; rank-FUSED so a bad pass can nudge, not tank.
        // The dynamic import keeps the worker + transformers.js chunks out of
        // the main bundle entirely.
        (async () => {
          try {
            const { shouldSemanticRerank, semanticScores } = await import(
              "@/lib/semantic/client"
            );
            if (!shouldSemanticRerank(freeText, finalRanked.length)) return;
            if (searchRunIdRef.current !== runId) return;
            setSemanticState("scoring");
            const docs = finalRanked.slice(0, 150).map((p) => ({
              key: p.id,
              // Name + description is what the model can judge meaning from;
              // topics add intent tags cheaply. Capped to keep WASM fast.
              text: `${p.name}. ${(p.description ?? "").slice(0, 280)} ${(p.topics || []).slice(0, 6).join(" ")}`.trim(),
            }));
            const scores = await semanticScores(freeText, docs);
            if (searchRunIdRef.current !== runId) return;
            if (scores && scores.size > 0) {
              const w = semanticWeight(significantTokens(freeText).length);
              setProjects((prev) => blendSemantic(prev, scores, w));
              setSemanticState("applied");
            } else {
              setSemanticState("unavailable");
            }
          } catch {
            if (searchRunIdRef.current === runId) setSemanticState("unavailable");
          }
        })();

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

          // AI re-rank — async, never blocks. The deterministic BM25 order is
          // already on screen; when the AI ordering returns we rank-FUSE it in
          // (blendRerank dampens it against BM25, so a bad/partial response
          // can't tank ordering). Key-gated: keyless deploys keep pure BM25.
          // Run-id guarded so a stale rerank never applies to a newer search.
          rerankResults(
            freeText,
            finalRanked.slice(0, 20).map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              source: p.source,
            })),
          )
            .then((order) => {
              if (searchRunIdRef.current !== runId || !order) return;
              setProjects((prev) => blendRerank(prev, order));
            })
            .catch(() => {
              /* rerank is best-effort — BM25 order stands */
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
    setSemanticState("idle");
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
    semanticState,
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
