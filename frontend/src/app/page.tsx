"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { SearchBar } from "@/components/SearchBar";
import { UnifiedProjectCard } from "@/components/UnifiedProjectCard";
import { SourceFilter } from "@/components/SourceFilter";
import { SynthesisBox } from "@/components/SynthesisBox";
import { ResultsToolbar, SortMode, applyResultsView } from "@/components/ResultsToolbar";
import { TrendingSection } from "@/components/TrendingSection";
import { SavedSection } from "@/components/SavedSection";
import { DirectJumps } from "@/components/DirectJumps";
import { SearchProgressBar } from "@/components/SearchProgressBar";
import { CardSkeleton } from "@/components/CardSkeleton";
import { ShortcutHelpModal } from "@/components/ShortcutHelpModal";
import {
  searchAllSources,
  UnifiedProject,
  SourceType,
  mergeRelatedProjects,
  getSourceConfig,
  getSourceSearchUrl,
  expandQuery,
  rankCorpus,
  buildSearchQuery,
} from "@/lib/sources";
import { parseQuery, applyOperators, describeOperators } from "@/lib/query-parser";
import { toast } from "sonner";
import { Search, Globe, ArrowRight, Clock, X } from "lucide-react";

const HISTORY_KEY = "threadseeker:history:v1";
const HISTORY_MAX = 8;

// Per-tab cache of merged result sets so that retyping a recent query or
// popping back via browser history returns instantly instead of re-running
// every source. Cap + TTL keep sessionStorage bounded.
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

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function saveHistory(list: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch {
    /* quota, private mode — silently ignore */
  }
}

const ALL_SOURCES: SourceType[] = [
  "github",
  "huggingface",
  "gitlab",
  "npm",
  "pypi",
  "crates",
  "codeberg",
  "packagist",
  "rubygems",
  "jsr",
  "dockerhub",
  "flathub",
  "homebrew",
  "fdroid",
  "aur",
  "openvsx",
  "conda",
  "nuget",
  "wordpress",
  "maven",
  "paperswithcode",
  "arxiv",
  "zenodo",
  "hackernews",
  "reddit",
  "lobsters",
  "stackoverflow",
  "devto",
];

const EXAMPLE_QUERIES = [
  "react state management library",
  "python web scraping",
  "rust CLI framework",
  "LLM fine-tuning",
  "self-hosted analytics",
  "Go HTTP router",
  "image generation models",
  "PHP authentication package",
];

export default function Home() {
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSources, setPendingSources] = useState(0);
  const [pendingSourceList, setPendingSourceList] = useState<SourceType[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(ALL_SOURCES);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [activeSourceFilter, setActiveSourceFilter] = useState<SourceType | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const initialLoadDone = useRef(false);
  const searchRunIdRef = useRef(0);
  const resultsGridRef = useRef<HTMLDivElement | null>(null);

  // Parsed query operators (lang:, source:, stars:>, license:) derived from
  // the raw query each render. Applied as a post-filter on projects below.
  const parsedQuery = useMemo(() => parseQuery(query), [query]);

  // Keyboard navigation across result cards. j/ArrowDown → next, k/ArrowUp →
  // prev, Enter → open focused card's URL (cmd/ctrl-Enter opens in new tab
  // explicitly; plain Enter also opens in a new tab so we never steal the
  // ThreadSeeker page). Skipped while typing in inputs/textareas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (!hasSearched) return;

      const grid = resultsGridRef.current;
      if (!grid) return;
      const cards = grid.querySelectorAll<HTMLElement>("[data-result-card]");
      if (cards.length === 0) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => {
          const next = Math.min(cards.length - 1, i < 0 ? 0 : i + 1);
          cards[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => {
          const next = Math.max(0, i <= 0 ? 0 : i - 1);
          cards[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      } else if (e.key === "Enter" && focusedIdx >= 0) {
        const card = cards[focusedIdx];
        const url = card?.getAttribute("data-result-url");
        if (url) {
          e.preventDefault();
          window.open(url, "_blank", "noopener,noreferrer");
        }
      } else if (e.key === "Escape") {
        setFocusedIdx(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasSearched, focusedIdx]);

  // Reset focus whenever results change underneath us.
  useEffect(() => {
    setFocusedIdx(-1);
  }, [query, sortMode, activeSourceFilter, selectedSources]);

  const handleSearch = useCallback(
    async (searchQuery: string, preserveView: boolean = false) => {
      const q = searchQuery.trim();
      if (!q) return;

      // Strip operators so upstream APIs only see free-text; operator filters
      // are applied as a post-filter on the merged result set.
      const parsed = parseQuery(q);
      const freeText = parsed.freeText || q;

      // Bump run id so stale progress events from an older search are ignored.
      searchRunIdRef.current += 1;
      const runId = searchRunIdRef.current;
      const startedAt = performance.now();

      setQuery(q);
      setProjects([]);
      setIsLoading(true);
      setSearchDurationMs(null);
      // If the query pins a specific source, only search that one.
      const targetSources = parsed.source && (selectedSources as string[]).includes(parsed.source)
        ? [parsed.source]
        : selectedSources;
      setPendingSources(targetSources.length);
      setPendingSourceList(targetSources);
      setHasSearched(true);

      // Record the query in local history (most-recent first, deduped).
      setHistory((prev) => {
        const next = [q, ...prev.filter((h) => h !== q)].slice(0, HISTORY_MAX);
        saveHistory(next);
        return next;
      });
      // Preserve URL-restored view on initial auto-search; otherwise reset.
      if (!preserveView) {
        setActiveSourceFilter(null);
        setSortMode("relevance");
      }

      try {
        // Deterministic synonym expansion — no backend call. For sources that
        // accept boolean OR syntax (github/gitlab/codeberg), expand the query
        // to include synonym terms; everything else uses the raw query.
        const expansion = expandQuery(freeText);
        const overrides: Partial<Record<SourceType, string>> = {};
        const orExpanded = buildSearchQuery(freeText, expansion, { supportsOr: true });
        if (orExpanded !== freeText) {
          overrides.github = orExpanded;
          overrides.gitlab = orExpanded;
          overrides.codeberg = orExpanded;
        }

        // Stream each source's results into state as they arrive. The
        // skeleton disappears the moment the first source returns.
        const results = await searchAllSources(
          freeText,
          targetSources,
          true,
          overrides,
          (event) => {
            if (searchRunIdRef.current !== runId) return; // stale run
            setPendingSources(event.remaining);
            setPendingSourceList((prev) => prev.filter((s) => s !== event.source));
            if (event.projects.length > 0) {
              setProjects((prev) => {
                // Merge by id (projects arrive per-source, so collisions are
                // rare but we dedupe defensively), then re-rank as a whole.
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
        );

        if (searchRunIdRef.current !== runId) return;
        // Final authoritative sort + cross-source dedup once everything is in.
        const ranked = rankCorpus(mergeRelatedProjects(results), freeText, expansion);
        setProjects(ranked);

        if (results.length === 0) {
          toast.info("No results found. Try different keywords or enable more sources.");
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
    [selectedSources]
  );

  // Read ?q= and ?sources= from URL on first mount and auto-search.
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    setHistory(loadHistory());

    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get("q")?.trim();
    const urlSources = params.get("sources");
    const urlSort = params.get("sort");
    const urlFilter = params.get("filter");

    if (urlSources) {
      const parsed = urlSources
        .split(",")
        .filter((s): s is SourceType => (ALL_SOURCES as string[]).includes(s));
      if (parsed.length > 0) setSelectedSources(parsed);
    }

    if (urlSort && ["relevance", "stars", "recent"].includes(urlSort)) {
      setSortMode(urlSort as SortMode);
    }

    if (urlFilter && (ALL_SOURCES as string[]).includes(urlFilter)) {
      setActiveSourceFilter(urlFilter as SourceType);
    }

    if (urlQuery) {
      handleSearch(urlQuery, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync with the active query + sources + view so results
  // (including the user's sort and source-chip filter) are shareable.
  useEffect(() => {
    if (!hasSearched) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (selectedSources.length !== ALL_SOURCES.length) {
      params.set("sources", selectedSources.join(","));
    }
    if (sortMode !== "relevance") params.set("sort", sortMode);
    if (activeSourceFilter) params.set("filter", activeSourceFilter);
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [query, selectedSources, hasSearched, sortMode, activeSourceFilter]);

  const handleSourceToggle = (source: SourceType) => {
    setSelectedSources((prev) => {
      const next = prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source];
      return next.length > 0 ? next : prev;
    });
  };

  const activeSources = selectedSources.length;
  const resultCount = projects.length;

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-slate-100 focus:px-3 focus:py-1.5 focus:text-xs focus:text-slate-900 focus:shadow-lg"
      >
        Skip to main content
      </a>
      <SearchProgressBar
        total={selectedSources.length}
        remaining={pendingSources}
        active={isLoading}
      />
      <ShortcutHelpModal />
      <main id="main-content">
      {/* Search hero */}
      <section className="border-b border-slate-800/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-8">
          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-100 mb-2">
              Search open source everywhere
            </h1>
            <p className="text-sm text-slate-500 max-w-lg mx-auto">
              One query across {activeSources} platforms — repos, packages,
              models, and community threads.
            </p>
          </div>

          {/* Search bar */}
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />

          {/* Source filter */}
          <div className="mt-4 flex justify-center">
            <SourceFilter
              allSources={ALL_SOURCES}
              selectedSources={selectedSources}
              onToggle={handleSourceToggle}
            />
          </div>

          {/* Recent searches — from local storage */}
          {!hasSearched && !isLoading && history.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-center gap-2 mb-2 text-[10px] uppercase tracking-wide text-slate-600">
                <Clock className="w-3 h-3" />
                Recent
                <button
                  onClick={() => {
                    setHistory([]);
                    saveHistory([]);
                  }}
                  className="ml-1 text-slate-700 hover:text-slate-500 transition-colors"
                  title="Clear history"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {history.map((h) => (
                  <button
                    key={h}
                    onClick={() => handleSearch(h)}
                    className="group flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800/70 border border-slate-800/60 hover:border-slate-700/60 rounded-full px-3 py-1.5 transition-all"
                  >
                    <span>{h}</span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Saved projects — only on landing, only when non-empty */}
          {!hasSearched && !isLoading && <SavedSection />}

          {/* Trending — only on landing, behind the example queries */}
          {!hasSearched && !isLoading && (
            <TrendingSection onQueryClick={(q) => handleSearch(q)} />
          )}

          {/* Example queries — only on landing */}
          {!hasSearched && !isLoading && (
            <div className="mt-6">
              {history.length > 0 && (
                <div className="flex items-center justify-center mb-2 text-[10px] uppercase tracking-wide text-slate-600">
                  Try
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_QUERIES.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => handleSearch(eq)}
                    className="group flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/50 hover:border-slate-700/50 rounded-full px-3 py-1.5 transition-all"
                  >
                    <span>{eq}</span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {isLoading && resultCount === 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Searching {activeSources} sources</span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                {pendingSourceList.slice(0, 10).map((src) => (
                  <span
                    key={src}
                    title={getSourceConfig(src).name}
                    className="inline-block animate-pulse"
                  >
                    {getSourceConfig(src).icon}
                  </span>
                ))}
                {pendingSourceList.length > 10 && (
                  <span className="text-slate-600">
                    +{pendingSourceList.length - 10}
                  </span>
                )}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : resultCount > 0 ? (
          (() => {
            const sortedView = applyResultsView(projects, sortMode, activeSourceFilter);
            const view = applyOperators(sortedView, parsedQuery);
            const opSummary = describeOperators(parsedQuery);
            return (
              <div className="space-y-4">
                {/* Synthesis only renders once everything has landed, so we
                    don't spam the API with partial snapshots. */}
                {!isLoading && <SynthesisBox query={query} projects={projects} />}
                <DirectJumps query={parsedQuery.freeText || query} />
                <ResultsToolbar
                  projects={projects}
                  sortMode={sortMode}
                  onSortChange={setSortMode}
                  activeSource={activeSourceFilter}
                  onSourceClick={setActiveSourceFilter}
                />
                <p className="text-sm text-slate-500">
                  {view.length} {view.length === 1 ? "result" : "results"}
                  {activeSourceFilter && (
                    <span className="text-slate-600">
                      {" "}
                      from <span className="text-slate-400">{activeSourceFilter}</span>
                    </span>
                  )}
                  {parsedQuery.freeText && (
                    <span className="text-slate-600">
                      {" "}
                      for <span className="text-slate-400">{parsedQuery.freeText}</span>
                    </span>
                  )}
                  {opSummary && (
                    <span className="text-slate-600">
                      {" · "}
                      <span className="text-slate-400 font-mono text-xs">{opSummary}</span>
                    </span>
                  )}
                  {!isLoading && searchDurationMs !== null && (
                    <span className="text-slate-700">
                      {" · "}
                      {(searchDurationMs / 1000).toFixed(2)}s
                    </span>
                  )}
                  {isLoading && pendingSources > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      still searching
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        {pendingSourceList.slice(0, 6).map((src) => (
                          <span
                            key={src}
                            title={getSourceConfig(src).name}
                            className="inline-block"
                          >
                            {getSourceConfig(src).icon}
                          </span>
                        ))}
                        {pendingSourceList.length > 6 && (
                          <span className="text-slate-600">
                            +{pendingSourceList.length - 6}
                          </span>
                        )}
                      </span>
                    </span>
                  )}
                </p>

                <div
                  ref={resultsGridRef}
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {view.map((project, idx) => (
                    <div
                      key={project.id}
                      data-result-card
                      data-result-url={project.url}
                      className={`transition-shadow rounded-xl ${
                        focusedIdx === idx
                          ? "ring-2 ring-amber-500/60 ring-offset-2 ring-offset-black"
                          : ""
                      }`}
                    >
                      <UnifiedProjectCard
                        project={project}
                        query={query}
                        onTopicClick={(t) => handleSearch(t)}
                      />
                    </div>
                  ))}
                </div>

                {/* Escape hatch when the user wants more than ThreadSeeker's
                    top-ranked slice from a single source. */}
                {activeSourceFilter && query && getSourceSearchUrl(activeSourceFilter, query) && (
                  <div className="flex justify-center pt-4">
                    <a
                      href={getSourceSearchUrl(activeSourceFilter, query) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/50 hover:border-slate-700/60 rounded-full px-3 py-1.5 transition-colors"
                    >
                      <span>{getSourceConfig(activeSourceFilter).icon}</span>
                      <span>
                        See all results on {getSourceConfig(activeSourceFilter).name}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* "Load more" equivalent for the unfiltered view — deep-links
                    out to the native search on the top-hit sources, since
                    in-app pagination isn't uniform across 24 APIs. */}
                {!activeSourceFilter && query && parsedQuery.freeText && (() => {
                  const counts = new Map<SourceType, number>();
                  for (const p of view) {
                    counts.set(p.source, (counts.get(p.source) ?? 0) + 1);
                  }
                  const top = [...counts.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([s]) => s)
                    .filter((s) => getSourceSearchUrl(s, parsedQuery.freeText));
                  if (top.length === 0) return null;
                  return (
                    <div className="pt-4 border-t border-slate-900/60 mt-2">
                      <div className="text-center text-[10px] uppercase tracking-wide text-slate-600 mb-2">
                        More from
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {top.map((src) => (
                          <a
                            key={src}
                            href={getSourceSearchUrl(src, parsedQuery.freeText) || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/50 hover:border-slate-700/60 rounded-full px-3 py-1.5 transition-colors"
                          >
                            <span>{getSourceConfig(src).icon}</span>
                            <span>{getSourceConfig(src).name}</span>
                            <ArrowRight className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()
        ) : hasSearched ? (
          <div className="text-center py-20">
            <Search className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-400">No results found</p>
            <p className="text-xs text-slate-600 mt-1">
              Try different keywords or enable more sources
            </p>
            {/* Actionable suggestions when no results. Priority:
                1) If the query has operators, offer to drop them.
                2) If source filters exclude some platforms, offer "all sources".
                3) Always offer a direct GitHub search as a fallback. */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {describeOperators(parsedQuery) && (
                <button
                  onClick={() => handleSearch(parsedQuery.freeText || query)}
                  className="text-xs text-slate-400 hover:text-slate-100 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/50 hover:border-slate-700/60 rounded-full px-3 py-1.5 transition-colors"
                >
                  Drop filters: <span className="font-mono text-slate-500">{describeOperators(parsedQuery)}</span>
                </button>
              )}
              {selectedSources.length < ALL_SOURCES.length && (
                <button
                  onClick={() => {
                    setSelectedSources(ALL_SOURCES);
                    handleSearch(query);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-100 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/50 hover:border-slate-700/60 rounded-full px-3 py-1.5 transition-colors"
                >
                  Search all {ALL_SOURCES.length} sources
                </button>
              )}
              {parsedQuery.freeText && parsedQuery.freeText.split(/\s+/).length > 1 && (
                <button
                  onClick={() => {
                    const tokens = parsedQuery.freeText.split(/\s+/).filter(Boolean);
                    // Drop the shortest non-stopword token (usually the most
                    // specific / most likely to be a typo).
                    const stop = new Set(["the", "a", "an", "for", "to", "of", "in", "on"]);
                    const candidates = tokens.filter((t) => !stop.has(t.toLowerCase()));
                    const victim = candidates.sort((a, b) => a.length - b.length)[0] ?? tokens[0];
                    const next = tokens.filter((t) => t !== victim).join(" ");
                    if (next.trim()) handleSearch(next);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-100 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/50 hover:border-slate-700/60 rounded-full px-3 py-1.5 transition-colors"
                >
                  Try broader: drop one term
                </button>
              )}
              <a
                href={`https://github.com/search?q=${encodeURIComponent(parsedQuery.freeText || query)}&type=repositories`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-500 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/50 hover:border-slate-700/60 rounded-full px-3 py-1.5 transition-colors inline-flex items-center gap-1"
              >
                Search GitHub directly <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <Globe className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              Search across GitHub, npm, PyPI, Hugging Face, Docker Hub,
              conda-forge, AUR, and {ALL_SOURCES.length - 7} more
            </p>
          </div>
        )}
      </section>
      </main>

      <footer className="mt-auto border-t border-slate-800/40 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
          <div>
            ThreadSeeker — unified search across {ALL_SOURCES.length} open-source
            platforms · no paid APIs · no tracking
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/PrivateVictories-Main/threadseeker"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-400 transition-colors"
            >
              GitHub
            </a>
            <span className="text-slate-800">·</span>
            <span>
              Press <kbd className="px-1 py-0.5 rounded border border-slate-800 text-slate-500">?</kbd> for shortcuts
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
