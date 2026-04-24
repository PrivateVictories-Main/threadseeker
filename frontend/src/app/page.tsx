"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SearchBar } from "@/components/SearchBar";
import { UnifiedProjectCard } from "@/components/UnifiedProjectCard";
import { SourceFilter } from "@/components/SourceFilter";
import { ResultsToolbar, SortMode, applyResultsView } from "@/components/ResultsToolbar";
import { TrendingSection } from "@/components/TrendingSection";
import { SavedSection } from "@/components/SavedSection";
import { DirectJumps } from "@/components/DirectJumps";
import { CardSkeleton } from "@/components/CardSkeleton";
import { ShortcutHelpModal } from "@/components/ShortcutHelpModal";
import { AnimatedGrid } from "@/components/motion/AnimatedGrid";
import { Toast } from "@/components/motion/Toast";
import { CountUp } from "@/components/motion/CountUp";
import { modeVariants, springSoft } from "@/lib/motion";
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
import { Search, ArrowRight, Clock, X, SearchX } from "lucide-react";

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
  "react state management",
  "python web scraping",
  "rust CLI framework",
  "LLM fine-tuning",
  "self-hosted analytics",
  "Go HTTP router",
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
  const [toast, setToast] = useState<string | null>(null);
  const [sourceFilterOpen, setSourceFilterOpen] = useState(false);
  const initialLoadDone = useRef(false);
  const searchRunIdRef = useRef(0);
  const resultsGridRef = useRef<HTMLDivElement | null>(null);
  // Tracks the last query we fired a search for, so the debounced
  // onChange handler and the Enter-submit handler don't double-fire
  // the same query.
  const lastSubmittedRef = useRef<string>("");

  // Parsed query operators (lang:, source:, stars:>, license:) derived from
  // the raw query each render. Applied as a post-filter on projects below.
  const parsedQuery = useMemo(() => parseQuery(query), [query]);

  // Mode = hero (landing) vs results. Once the user has searched, we never go
  // back to hero until they explicitly clear — that keeps the transition from
  // toggling on every keystroke.
  const mode: "hero" | "results" = hasSearched || isLoading || projects.length > 0 ? "results" : "hero";

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
      lastSubmittedRef.current = q;

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
        const hueByIntent: Record<string, number> = {
          project_search: 220,        // indigo
          how_to: 150,                // teal/sage
          recommendation: 200,        // sky
          comparison: 240,            // blue-violet
          troubleshooting: 350,       // rose (stays warm-but-red, not pink)
          model_search: 40,           // warm amber
          general: 220,               // indigo default
        };
        if (typeof document !== "undefined") {
          document.documentElement.style.setProperty("--ts-intent-hue", String(hueByIntent[expansion.intent] ?? 220));
        }
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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }, []);

  const handleSourceToggle = (source: SourceType) => {
    setSelectedSources((prev) => {
      const next = prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source];
      return next.length > 0 ? next : prev;
    });
  };

  const handleClear = useCallback(() => {
    searchRunIdRef.current += 1;
    setQuery("");
    setProjects([]);
    setIsLoading(false);
    setPendingSources(0);
    setPendingSourceList([]);
    setHasSearched(false);
    setActiveSourceFilter(null);
    setSortMode("relevance");
    lastSubmittedRef.current = "";
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const activeSources = selectedSources.length;
  const resultCount = projects.length;

  // Sort-friendly view (applied before operator post-filter).
  const sortedView = mode === "results" ? applyResultsView(projects, sortMode, activeSourceFilter) : projects;
  const view = applyOperators(sortedView, parsedQuery);
  const opSummary = describeOperators(parsedQuery);

  // Progress bar % for the sticky header.
  const progressPct = isLoading
    ? Math.min(100, Math.max(4, ((selectedSources.length - pendingSources) / Math.max(1, selectedSources.length)) * 100))
    : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-1.5 focus:text-xs focus:text-slate-900 focus:shadow-lg focus:border focus:border-indigo-300"
      >
        Skip to main content
      </a>
      <ShortcutHelpModal />
      <main id="main-content" className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "hero" ? (
            <motion.section
              key="hero"
              initial="heroEnter"
              animate="heroShow"
              exit="heroExit"
              variants={modeVariants}
              className="px-4 sm:px-6"
            >
              <div className="max-w-4xl mx-auto pt-16 sm:pt-24 lg:pt-28 pb-16">
                <div className="text-center mb-12">
                  <h1 className="text-balance text-[44px] sm:text-6xl lg:text-7xl font-semibold tracking-tight text-slate-900 mb-6 leading-[1.04]">
                    Search open source{" "}
                    <span className="ts-hero-accent">everywhere</span>
                  </h1>
                  <p className="text-[16px] sm:text-[17px] text-slate-500 max-w-xl mx-auto leading-relaxed">
                    One query, {activeSources} platforms — repositories,
                    packages, models, and community threads.
                  </p>
                </div>

                <SearchBar
                  onSearch={handleSearch}
                  isLoading={isLoading}
                  size="hero"
                  onDebouncedChange={(v) => {
                    const trimmed = v.trim();
                    if (!trimmed) return;
                    if (trimmed === lastSubmittedRef.current) return;
                    handleSearch(trimmed);
                  }}
                />

                {/* Try row — matches Recent pill rhythm */}
                <div className="mt-6 flex flex-wrap justify-center items-center gap-2">
                  <span className="text-[11px] text-slate-400 uppercase tracking-[0.14em] font-semibold mr-1">
                    Try
                  </span>
                  {EXAMPLE_QUERIES.map((eq) => (
                    <button
                      key={eq}
                      onClick={() => handleSearch(eq)}
                      className="group inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-600 hover:text-indigo-700 bg-white/70 hover:bg-white border border-indigo-200/80 hover:border-indigo-300 rounded-full px-3 py-1.5 transition-colors"
                    >
                      <span>{eq}</span>
                      <ArrowRight className="w-3 h-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>

                {/* Source filter — restrained, under a small disclosure row */}
                <div className="mt-8 flex flex-col items-center gap-2">
                  <button
                    onClick={() => setSourceFilterOpen((v) => !v)}
                    className="text-[11px] uppercase tracking-[0.14em] text-slate-400 hover:text-indigo-600 font-semibold transition-colors"
                    aria-expanded={sourceFilterOpen}
                  >
                    {sourceFilterOpen
                      ? `Hide sources`
                      : `Sources · ${activeSources}/${ALL_SOURCES.length}`}
                  </button>
                  {sourceFilterOpen && (
                    <SourceFilter
                      allSources={ALL_SOURCES}
                      selectedSources={selectedSources}
                      onToggle={handleSourceToggle}
                      onClear={() => setSelectedSources(ALL_SOURCES)}
                    />
                  )}
                </div>

                {/* Recent */}
                {history.length > 0 && (
                  <div className="mt-12">
                    <div className="flex items-center justify-center gap-1.5 mb-4 text-[11px] uppercase tracking-[0.14em] text-slate-400 font-semibold">
                      <Clock className="w-3 h-3" />
                      Recent
                      <button
                        onClick={() => {
                          setHistory([]);
                          saveHistory([]);
                        }}
                        className="ml-1 text-slate-300 hover:text-slate-600 transition-colors"
                        title="Clear history"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {history.slice(0, 6).map((h) => (
                        <button
                          key={h}
                          onClick={() => handleSearch(h)}
                          className="group inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3 py-1.5 transition-all"
                        >
                          <span>{h}</span>
                          <ArrowRight className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <SavedSection />
                <TrendingSection onQueryClick={(q) => handleSearch(q)} />
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="results"
              initial="resultsEnter"
              animate="resultsShow"
              exit="resultsExit"
              variants={modeVariants}
              className="flex flex-col"
            >
              {/* Sticky glass header with compact SearchBar + live readout */}
              <div className="sticky top-0 z-20 glass-sticky">
                <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0 sm:max-w-xl">
                    <SearchBar
                      onSearch={handleSearch}
                      isLoading={isLoading}
                      size="compact"
                      initialValue={query}
                      onDebouncedChange={(v) => {
                        const trimmed = v.trim();
                        if (!trimmed) return;
                        if (trimmed === lastSubmittedRef.current) return;
                        handleSearch(trimmed);
                      }}
                    />
                  </div>
                  <div className="hidden sm:flex items-center gap-3 text-[12.5px] text-slate-600 tabular-nums">
                    <span>
                      <CountUp value={view.length} />
                      <span className="text-slate-400"> results</span>
                    </span>
                    {isLoading && pendingSources > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        {pendingSources} loading
                      </span>
                    )}
                    {!isLoading && searchDurationMs !== null && (
                      <span className="text-slate-400">
                        {(searchDurationMs / 1000).toFixed(2)}s
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleClear}
                    className="text-[12.5px] text-slate-500 hover:text-indigo-700 font-medium transition-colors px-2 py-1.5 rounded-md hover:bg-white/60 flex-shrink-0"
                    title="Clear search and return home"
                  >
                    Clear
                  </button>
                </div>
                {/* Thin progress bar along the bottom edge of the header */}
                {isLoading && (
                  <div className="ts-sticky-progress" aria-hidden>
                    <span style={{ width: `${progressPct}%` }} />
                  </div>
                )}
              </div>

              <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 w-full">
                {isLoading && resultCount === 0 ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 text-[13px] text-slate-500">
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
                          <span className="text-slate-400">
                            +{pendingSourceList.length - 10}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="grid gap-5 lg:gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <CardSkeleton key={i} />
                      ))}
                    </div>
                  </div>
                ) : resultCount > 0 ? (
                  <div className="space-y-4">
                    <DirectJumps query={parsedQuery.freeText || query} />

                    <ResultsToolbar
                      projects={projects}
                      sortMode={sortMode}
                      onSortChange={setSortMode}
                      activeSource={activeSourceFilter}
                      onSourceClick={setActiveSourceFilter}
                    />

                    <p className="text-[13px] text-slate-500 px-1">
                      <span className="text-slate-800 font-semibold">{view.length}</span>{" "}
                      {view.length === 1 ? "result" : "results"}
                      {activeSourceFilter && (
                        <span>
                          {" "}
                          from{" "}
                          <span className="text-indigo-700 font-medium">
                            {getSourceConfig(activeSourceFilter).name}
                          </span>
                        </span>
                      )}
                      {parsedQuery.freeText && (
                        <span>
                          {" "}
                          for{" "}
                          <span className="text-indigo-700 font-medium">
                            {parsedQuery.freeText}
                          </span>
                        </span>
                      )}
                      {opSummary && (
                        <span>
                          {" · "}
                          <span className="text-slate-600 font-mono text-[11.5px]">
                            {opSummary}
                          </span>
                        </span>
                      )}
                    </p>

                    <AnimatedGrid
                      ref={resultsGridRef}
                      keyed={query || parsedQuery.freeText}
                      className="grid gap-5 lg:gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr"
                    >
                      {view.map((project, idx) => (
                        <div
                          key={project.id}
                          data-result-card
                          data-result-url={project.url}
                          className={`h-full transition-shadow rounded-[18px] ${
                            focusedIdx === idx
                              ? "ring-2 ring-indigo-500/60 ring-offset-2 ring-offset-transparent"
                              : ""
                          }`}
                        >
                          <UnifiedProjectCard project={project} onToast={showToast} />
                        </div>
                      ))}
                    </AnimatedGrid>

                    {/* Escape hatch when the user wants more than ThreadSeeker's
                        top-ranked slice from a single source. */}
                    {activeSourceFilter && query && getSourceSearchUrl(activeSourceFilter, query) && (
                      <div className="flex justify-center pt-6">
                        <a
                          href={getSourceSearchUrl(activeSourceFilter, query) || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3.5 py-1.5 transition-colors"
                        >
                          <span>{getSourceConfig(activeSourceFilter).icon}</span>
                          <span>
                            See all on {getSourceConfig(activeSourceFilter).name}
                          </span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* "Load more" equivalent for the unfiltered view — deep-links
                        out to the native search on the top-hit sources. */}
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
                        <div className="pt-6 mt-2">
                          <div className="text-center text-[11px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-2.5">
                            More from
                          </div>
                          <div className="flex flex-wrap justify-center gap-2">
                            {top.map((src) => (
                              <a
                                key={src}
                                href={getSourceSearchUrl(src, parsedQuery.freeText) || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3.5 py-1.5 transition-colors"
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
                ) : hasSearched ? (
                  // Empty state — centered, friendly.
                  <div className="flex flex-col items-center text-center py-24">
                    <div
                      className="w-16 h-16 rounded-full glass-strong flex items-center justify-center mb-5"
                      aria-hidden
                    >
                      <SearchX className="w-7 h-7 text-indigo-400" />
                    </div>
                    <p className="text-lg font-semibold text-slate-800">
                      No results found
                    </p>
                    <p className="text-[13.5px] text-slate-500 mt-1.5 max-w-sm">
                      Try broadening your query, removing filters, or enabling
                      more sources.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                      {describeOperators(parsedQuery) && (
                        <button
                          onClick={() => handleSearch(parsedQuery.freeText || query)}
                          className="text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3.5 py-1.5 transition-colors"
                        >
                          Drop filters:{" "}
                          <span className="font-mono text-slate-500">
                            {describeOperators(parsedQuery)}
                          </span>
                        </button>
                      )}
                      {selectedSources.length < ALL_SOURCES.length && (
                        <button
                          onClick={() => {
                            setSelectedSources(ALL_SOURCES);
                            handleSearch(query);
                          }}
                          className="text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3.5 py-1.5 transition-colors"
                        >
                          Search all {ALL_SOURCES.length} sources
                        </button>
                      )}
                      {parsedQuery.freeText && parsedQuery.freeText.split(/\s+/).length > 1 && (
                        <button
                          onClick={() => {
                            const tokens = parsedQuery.freeText.split(/\s+/).filter(Boolean);
                            const stop = new Set(["the", "a", "an", "for", "to", "of", "in", "on"]);
                            const candidates = tokens.filter((t) => !stop.has(t.toLowerCase()));
                            const victim = candidates.sort((a, b) => a.length - b.length)[0] ?? tokens[0];
                            const next = tokens.filter((t) => t !== victim).join(" ");
                            if (next.trim()) handleSearch(next);
                          }}
                          className="text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3.5 py-1.5 transition-colors"
                        >
                          Drop one term
                        </button>
                      )}
                      <a
                        href={`https://github.com/search?q=${encodeURIComponent(parsedQuery.freeText || query)}&type=repositories`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3.5 py-1.5 transition-colors inline-flex items-center gap-1"
                      >
                        Search GitHub directly <ArrowRight className="w-3 h-3" />
                      </a>
                      <button
                        onClick={handleClear}
                        className="text-[12.5px] font-medium text-slate-500 hover:text-indigo-700 transition-colors px-3.5 py-1.5"
                      >
                        Back to home
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t border-indigo-100/70">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-slate-500">
          <div>
            ThreadSeeker — unified search across {ALL_SOURCES.length} open-source
            platforms · no paid APIs · no tracking
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/PrivateVictories-Main/threadseeker"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-700 transition-colors font-medium"
            >
              GitHub
            </a>
            <span className="text-slate-300">·</span>
            <span>
              Press{" "}
              <kbd className="px-1.5 py-0.5 rounded border border-indigo-200 bg-white text-slate-700 font-mono text-[11px]">
                ?
              </kbd>{" "}
              for shortcuts
            </span>
          </div>
        </div>
      </footer>
      <Toast message={toast} />
    </div>
  );
}
