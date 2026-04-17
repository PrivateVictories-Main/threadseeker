"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SearchBar } from "@/components/SearchBar";
import { UnifiedProjectCard } from "@/components/UnifiedProjectCard";
import { SourceFilter } from "@/components/SourceFilter";
import { SynthesisBox } from "@/components/SynthesisBox";
import { ResultsToolbar, SortMode, applyResultsView } from "@/components/ResultsToolbar";
import {
  searchAllSources,
  UnifiedProject,
  SourceType,
  mergeRelatedProjects,
  getSourceConfig,
  getSourceSearchUrl,
} from "@/lib/sources";
import { optimizeQueries, isBackendConfigured } from "@/lib/api-client";
import { toast } from "sonner";
import { Search, Globe, ArrowRight, Clock, X } from "lucide-react";

const HISTORY_KEY = "threadseeker:history:v1";
const HISTORY_MAX = 8;

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
  "paperswithcode",
  "arxiv",
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
  const initialLoadDone = useRef(false);
  const searchRunIdRef = useRef(0);

  const handleSearch = useCallback(
    async (searchQuery: string, preserveView: boolean = false) => {
      const q = searchQuery.trim();
      if (!q) return;

      // Bump run id so stale progress events from an older search are ignored.
      searchRunIdRef.current += 1;
      const runId = searchRunIdRef.current;

      setQuery(q);
      setProjects([]);
      setIsLoading(true);
      setPendingSources(selectedSources.length);
      setPendingSourceList(selectedSources);
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
        // Fetch AI-optimized per-platform queries in parallel with a best-effort timeout.
        // If the backend is down or slow, fall back to the raw query everywhere.
        let overrides: Partial<Record<SourceType, string>> = {};
        if (isBackendConfigured()) {
          const timeoutP = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 3500),
          );
          const optimized = await Promise.race([optimizeQueries(q), timeoutP]);
          if (optimized) {
            overrides = {
              github: optimized.github_query,
              gitlab: optimized.github_query,
              codeberg: optimized.github_query,
              huggingface: optimized.huggingface_query,
              reddit: optimized.reddit_query,
              hackernews: optimized.reddit_query,
            };
          }
        }

        // Stream each source's results into state as they arrive. The
        // skeleton disappears the moment the first source returns.
        const results = await searchAllSources(
          q,
          selectedSources,
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
        setProjects(mergeRelatedProjects(results));

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
                <div
                  key={i}
                  className="h-52 rounded-lg bg-slate-900/30 animate-pulse border border-slate-800/40"
                />
              ))}
            </div>
          </div>
        ) : resultCount > 0 ? (
          (() => {
            const view = applyResultsView(projects, sortMode, activeSourceFilter);
            return (
              <div className="space-y-4">
                {/* Synthesis only renders once everything has landed, so we
                    don't spam the API with partial snapshots. */}
                {!isLoading && <SynthesisBox query={query} projects={projects} />}
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
                  {query && (
                    <span className="text-slate-600">
                      {" "}
                      for <span className="text-slate-400">{query}</span>
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {view.map((project) => (
                    <UnifiedProjectCard
                      key={project.id}
                      project={project}
                      query={query}
                    />
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
            <span>Press <kbd className="px-1 py-0.5 rounded border border-slate-800 text-slate-500">/</kbd> to search</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
