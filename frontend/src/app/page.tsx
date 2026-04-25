"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { SearchBar } from "@/components/SearchBar";
import { BrandMark } from "@/components/BrandMark";
import { UnifiedProjectCard } from "@/components/UnifiedProjectCard";
import { SourceFilter } from "@/components/SourceFilter";
import { ResultsToolbar, SortMode, applyResultsView } from "@/components/ResultsToolbar";
import { TrendingSection } from "@/components/TrendingSection";
import { SavedSection } from "@/components/SavedSection";
import { DirectJumps } from "@/components/DirectJumps";
import { CardSkeleton } from "@/components/CardSkeleton";
import { ShortcutHelpModal, ShortcutHelpButton } from "@/components/ShortcutHelpModal";
import { CommandPalette, COMMAND_PALETTE_OPEN_EVENT } from "@/components/CommandPalette";
import { NetworkErrorMessage, NetworkErrorTray } from "@/components/network/NetworkErrorMessage";
import { AnimatedGrid } from "@/components/motion/AnimatedGrid";
import { Toast } from "@/components/motion/Toast";
import { CountUp } from "@/components/motion/CountUp";
import { modeVariants } from "@/lib/motion";
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
  sparseFraction,
} from "@/lib/sources";
import { parseQuery, applyOperators, describeOperators } from "@/lib/query-parser";
import { toast } from "sonner";
import { ArrowRight, Clock, X, SearchX, Github } from "lucide-react";

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
  // Sources that errored out during the current search run. Reset at the
  // start of each search; populated incrementally via the progress
  // callback. Powers the toolbar's "N sources unavailable" indicator and
  // the all-sources-failed retry card.
  const [failedSources, setFailedSources] = useState<SourceType[]>([]);
  // Source count for the most-recent search run. Used to detect the
  // "every queried source failed" case so the empty state can route to a
  // retry card instead of the generic no-results message.
  const [lastSearchedCount, setLastSearchedCount] = useState(0);
  // Sources that completed successfully but returned zero matches. Lets
  // the toolbar render quiet "0" badges on empty filter pills so the user
  // can see "I queried this source and it had nothing" rather than
  // wondering whether their selection took effect.
  const [emptySources, setEmptySources] = useState<SourceType[]>([]);
  // Whether the failed-sources tray (set by the toolbar indicator) is open.
  const [failedTrayOpen, setFailedTrayOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(ALL_SOURCES);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [activeSourceFilter, setActiveSourceFilter] = useState<SourceType | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  // Local lightweight "Copied: …" toast (separate channel from sonner's
  // `toast.info` / `toast.error` calls). Renamed from `toast` to
  // `toastMessage` because the bare `toast` name shadowed the imported
  // sonner singleton inside this component scope — calls like
  // `toast.info(...)` below would resolve to the state value (null) and
  // throw a TypeError at runtime instead of dispatching a sonner toast.
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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

  // Sticky header shadow accumulates with scroll depth. At top (y=0) the
  // header reads almost flat; the shadow tweens in across the first
  // 120px of scroll so the depth signal feels atmospheric rather than
  // snap-on. Eased input (slight ease-out applied via the second
  // breakpoint) keeps the shadow restrained for the first few px of
  // touch-bounce without delaying the eventual full-shadow read.
  // useScroll/useTransform run on the rAF cycle so this doesn't trigger
  // React re-renders.
  const { scrollY } = useScroll();
  const stickyShadowOpacity = useTransform(
    scrollY,
    [0, 24, 120],
    [0, 0.18, 1],
  );

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

  // Tracks the *id* of the currently focused project (not its index in the
  // view). When sort or filter changes, the index can shift but the id is
  // stable, so we re-derive the index without dropping focus. When the
  // focused project disappears from the view entirely, focus resets.
  const focusedIdRef = useRef<string | null>(null);

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
      setFailedSources([]);
      setEmptySources([]);
      setLastSearchedCount(targetSources.length);
      setFailedTrayOpen(false);
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
            if (event.error) {
              setFailedSources((prev) =>
                prev.includes(event.source) ? prev : [...prev, event.source],
              );
            } else if (event.projects.length === 0) {
              // Source responded successfully but had nothing to say.
              // Distinct from failedSources — this isn't an error,
              // just a "no matches here" signal we surface in the
              // toolbar pills as a quiet "0" badge.
              setEmptySources((prev) =>
                prev.includes(event.source) ? prev : [...prev, event.source],
              );
            }
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

  // Iter-15 / Track 3 — Read ?q= and ?sources= from URL on first mount.
  //
  // Uses useLayoutEffect so the state flips (history, selectedSources,
  // sortMode, activeSourceFilter, hasSearched-via-handleSearch) happen
  // synchronously BEFORE the browser commits the first paint. Effect
  // takeaway: a user landing on /?q=react no longer sees the hero
  // section flash for a frame before the results-mode skeleton — the
  // initial paint goes straight to "Searching N sources" with the
  // skeleton grid, the way a refresh on a live results URL should feel.
  //
  // useLayoutEffect is safe here because:
  //   - We're guarded by initialLoadDone so it only runs once
  //   - All the work is sync (URL parse + setState)
  //   - The actual network call inside handleSearch is async — paint is
  //     not blocked on the fetch, just on the mode-flip state update
  //
  // Wrapped in `typeof window !== 'undefined'` so the SSR pass (where
  // useLayoutEffect logs a warning + no-ops) silently does nothing
  // until hydration on the client.
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
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
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
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
    setFailedSources([]);
    setEmptySources([]);
    setHasSearched(false);
    setActiveSourceFilter(null);
    setSortMode("relevance");
    lastSubmittedRef.current = "";
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const activeSources = selectedSources.length;
  const resultCount = projects.length;

  // Skeleton geometry picker. The "sparse" sources (community discussion
  // threads — registry sources tagged sparse:true) typically render in the
  // 260px sparse-card shell (no description / no topics). When ≥60% of the
  // active selection is sparse, the loading skeletons match the shorter
  // geometry so the grid doesn't visually pop 340 → 260 on data-in.
  // Threshold lives at 60% — predictable, and gives one-of-three / two-of-five
  // mixed selections the tall geometry while three-of-five still goes sparse.
  const skeletonsShouldBeSparse = sparseFraction(selectedSources) >= 0.6;

  // Sort-friendly view (applied before operator post-filter).
  // Both stages memoized so the array identity is stable when inputs
  // haven't changed — avoids cascading O(n) work in the focusedIdx
  // map effect + cheaper React reconciliation when sort/filter UI
  // re-renders without changing the underlying view.
  const sortedView = useMemo(
    () => (mode === "results" ? applyResultsView(projects, sortMode, activeSourceFilter) : projects),
    [mode, projects, sortMode, activeSourceFilter],
  );
  const view = useMemo(
    () => applyOperators(sortedView, parsedQuery),
    [sortedView, parsedQuery],
  );
  const opSummary = describeOperators(parsedQuery);

  // O(n) once per view change — far cheaper than the previous DOM walk
  // (`querySelectorAll('[data-result-card]')` on every render of pages
  // with 100+ cards). Keyed by id, not index, so sort/filter changes
  // re-resolve the focused index instead of dropping focus.
  const viewIdToIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < view.length; i++) {
      map.set(view[i].id, i);
    }
    return map;
  }, [view]);

  // Reset focus only when the focused card actually disappears from the
  // current view (or when we have no focus to begin with). Uses the
  // memoized id→index lookup above instead of re-walking the DOM each
  // dep change.
  useEffect(() => {
    if (focusedIdx < 0) {
      focusedIdRef.current = null;
      return;
    }
    const currentId = view[focusedIdx]?.id;
    if (focusedIdRef.current && currentId !== focusedIdRef.current) {
      // Index is stale — same project might still be in the view at a
      // different position (sort changed) or might be gone (filter removed
      // it). Map lookup is O(1) here.
      const nextIdx = viewIdToIndex.get(focusedIdRef.current) ?? -1;
      setFocusedIdx(nextIdx);
      if (nextIdx < 0) focusedIdRef.current = null;
    } else if (currentId) {
      focusedIdRef.current = currentId;
    }
  }, [focusedIdx, view, viewIdToIndex]);

  // Progress bar % for the sticky header.
  const progressPct = isLoading
    ? Math.min(100, Math.max(4, ((selectedSources.length - pendingSources) / Math.max(1, selectedSources.length)) * 100))
    : 0;

  // Screen-reader live announcement. Updates as the search progresses
  // (loading → results) so non-visual users get the same "your query
  // returned N results across M sources" affordance that sighted users
  // read off the toolbar count line. Polite so it doesn't interrupt
  // ongoing speech.
  const liveAnnouncement = (() => {
    if (!hasSearched) return "";
    if (isLoading) {
      const targetCount = lastSearchedCount || selectedSources.length;
      return `Searching ${targetCount} ${targetCount === 1 ? "source" : "sources"}.`;
    }
    if (lastSearchedCount > 0 && failedSources.length === lastSearchedCount) {
      return `Couldn't reach any sources. Retry available.`;
    }
    const term = (parsedQuery.freeText || query).trim();
    const count = projects.length;
    const sourceWord = lastSearchedCount === 1 ? "source" : "sources";
    const failedNote =
      failedSources.length > 0
        ? `, ${failedSources.length} ${failedSources.length === 1 ? "source" : "sources"} unavailable`
        : "";
    if (count === 0) {
      return `No results found${term ? ` for ${term}` : ""}${failedNote}.`;
    }
    return `${count} ${count === 1 ? "result" : "results"}${term ? ` for ${term}` : ""} across ${lastSearchedCount} ${sourceWord}${failedNote}.`;
  })();

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-1.5 focus:text-xs focus:text-slate-900 focus:shadow-lg focus:border focus:border-indigo-300"
      >
        Skip to main content
      </a>
      {/* Visually-hidden live region. Screen readers will announce as
          search status / result counts change. role=status + aria-live=
          polite so it doesn't interrupt currently-speaking content. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>
      <ShortcutHelpModal />
      {/* ⌘K command palette — global trigger; can be opened from
          anywhere via the COMMAND_PALETTE_OPEN_EVENT custom event. The
          floating "press ⌘K" chip in the sticky header dispatches it. */}
      <CommandPalette
        onSearch={(q) => handleSearch(q)}
        onSortChange={setSortMode}
        onSourceFilterChange={setActiveSourceFilter}
        onClearHistory={() => {
          setHistory([]);
          saveHistory([]);
        }}
        onResetSources={() => setSelectedSources(ALL_SOURCES)}
        activeSourceFilter={activeSourceFilter}
        sortMode={sortMode}
        selectedSourcesCount={selectedSources.length}
        totalSourcesCount={ALL_SOURCES.length}
        initialQuery={query}
      />
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
              {/* Brand mark — top-left of the page on hero only. Inline
                  in the sticky results header below; here it gives the
                  landing page the same anchor without competing with the
                  centered headline. */}
              <div className="max-w-[1280px] mx-auto pt-6 sm:pt-7 px-1">
                <BrandMark variant="hero" />
              </div>

              <div className="max-w-4xl mx-auto pt-10 sm:pt-16 lg:pt-20 pb-16">
                <div className="text-center mb-10">
                  <span className="ts-hero-caption" aria-hidden>
                    Open-Source Index
                  </span>
                  <h1 className="ts-hero-headline text-balance">
                    Find what&apos;s worth{" "}
                    <span className="ts-hero-accent">building on.</span>
                  </h1>
                  <p className="mt-5 text-[15px] sm:text-[16px] text-slate-500 max-w-xl mx-auto leading-relaxed">
                    One query across {activeSources} platforms — repositories,
                    packages, models, and community threads. No accounts.
                  </p>
                </div>

                <SearchBar
                  onSearch={handleSearch}
                  isLoading={isLoading}
                  size="hero"
                  sourceCount={activeSources}
                  onDebouncedChange={(v) => {
                    const trimmed = v.trim();
                    if (!trimmed) return;
                    if (trimmed === lastSubmittedRef.current) return;
                    handleSearch(trimmed);
                  }}
                />

                {/* Stat strip — four monospace cells. Decorative trust
                    signals at the top of the funnel: how many sources we
                    cover, how big the index is, what to expect on speed,
                    and the no-account promise. The middle two values are
                    static placeholders — see overhaul-log iter 16. */}
                <div className="ts-stat-strip" aria-label="ThreadSeeker stats">
                  <div className="ts-stat-cell">
                    <span className="ts-stat-label">Sources</span>
                    <span className="ts-stat-value">{ALL_SOURCES.length}</span>
                  </div>
                  <div className="ts-stat-cell">
                    <span className="ts-stat-label">Repos indexed</span>
                    <span className="ts-stat-value">2.3M+</span>
                  </div>
                  <div className="ts-stat-cell">
                    <span className="ts-stat-label">Avg search</span>
                    <span className="ts-stat-value">~80ms</span>
                  </div>
                  <div className="ts-stat-cell">
                    <span className="ts-stat-label">Accounts</span>
                    <span className="ts-stat-value">0</span>
                  </div>
                </div>

                {/* Curated try-row — keeps the same Apple-style pill chrome
                    but the leading label is now monospace `// Try` so the
                    cluster reads as a code-comment hint rather than a
                    sans-serif "Try:" instruction. */}
                <div className="mt-7 flex flex-wrap justify-center items-center gap-x-2 gap-y-1.5">
                  <span className="ts-section-header mr-1">{"// Try"}</span>
                  {EXAMPLE_QUERIES.map((eq) => (
                    <button
                      key={eq}
                      onClick={() => handleSearch(eq)}
                      className="group inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-600 hover:text-indigo-700 bg-white/70 hover:bg-white border border-indigo-200/80 hover:border-indigo-300 rounded-full px-3 py-1.5 transition-all"
                    >
                      <span className="font-mono text-indigo-400/70 text-[11px] mr-0.5" aria-hidden>›</span>
                      <span>{eq}</span>
                      <ArrowRight
                        className="w-3 h-3 text-indigo-400 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>

                {/* Source filter — restrained, under a small disclosure row.
                    Disclosure label is now monospace + uses `·` separators
                    for technical density consistent with the rest of the hero. */}
                <div className="mt-8 flex flex-col items-center gap-2">
                  <button
                    onClick={() => setSourceFilterOpen((v) => !v)}
                    className="ts-section-header hover:!text-indigo-600 transition-colors"
                    aria-expanded={sourceFilterOpen}
                  >
                    {sourceFilterOpen ? (
                      <>{"// Hide sources"}</>
                    ) : (
                      <>
                        {"// Sources "}
                        <strong>{activeSources}</strong>
                        {`/${ALL_SOURCES.length}`}
                      </>
                    )}
                  </button>
                  {sourceFilterOpen && (
                    <SourceFilter
                      allSources={ALL_SOURCES}
                      selectedSources={selectedSources}
                      onToggle={handleSourceToggle}
                      onSetSelected={(next) => {
                        if (next.length > 0) setSelectedSources(next);
                      }}
                      onClear={() => setSelectedSources(ALL_SOURCES)}
                    />
                  )}
                </div>

                {/* Recent — staggered fade-in so the cluster materializes
                    rather than popping when the first query lands. */}
                {history.length > 0 && (
                  <motion.div
                    className="mt-12"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-4 ts-section-header">
                      <Clock className="w-3 h-3" aria-hidden />
                      {"// Recent"}
                      <button
                        onClick={() => {
                          setHistory([]);
                          saveHistory([]);
                        }}
                        className="ml-1 inline-flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:p-0 -my-1 text-slate-300 hover:text-slate-600 transition-colors rounded-full"
                        title="Clear history"
                        aria-label="Clear search history"
                      >
                        <X className="w-3 h-3" aria-hidden />
                      </button>
                    </div>
                    <motion.div
                      className="flex flex-wrap justify-center gap-2"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.04 } },
                      }}
                    >
                      {history.slice(0, 6).map((h) => (
                        <motion.button
                          key={h}
                          onClick={() => handleSearch(h)}
                          variants={{
                            hidden: { opacity: 0, y: 4 },
                            visible: { opacity: 1, y: 0 },
                          }}
                          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
                          className="group inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3 py-1.5 transition-all"
                        >
                          <span>{h}</span>
                          <ArrowRight
                            className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all"
                            aria-hidden
                          />
                        </motion.button>
                      ))}
                    </motion.div>
                  </motion.div>
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
              {/* Sticky glass header with compact SearchBar + live readout.
                  Shadow opacity is driven by scrollY so the header reads
                  flat at top of page and gains depth as the user scrolls
                  past ~60px — see stickyShadowOpacity above. Rendered as
                  a semantic <header> so screen readers and content-rail
                  navigation can locate the search affordance as a
                  banner-region landmark. */}
              <motion.header
                className="sticky top-0 z-20 glass-sticky"
                aria-label="Search and refine results"
                style={{ ["--ts-sticky-shadow-opacity" as string]: stickyShadowOpacity }}
              >
                <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
                  {/* Brand mark — anchors the left edge of the sticky
                      command bar. Inline variant drops the version chip
                      so the bar doesn't feel chrome-heavy. Hidden below
                      sm so the search has room on phones. */}
                  <div className="hidden sm:flex items-center flex-shrink-0">
                    <BrandMark variant="inline" />
                  </div>
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
                  {/* Stats cluster — all monospace with `·` separators
                      so it reads as a single technical readout instead
                      of a sans-serif word salad. Tabular-nums everywhere
                      that produces a number. */}
                  <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-slate-500 tabular-nums uppercase tracking-[0.06em]">
                    <span className="text-slate-700 font-semibold">
                      <CountUp value={view.length} />
                    </span>
                    <span className="text-slate-400">results</span>
                    {isLoading && pendingSources > 0 && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1.5 text-indigo-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" aria-hidden />
                          {pendingSources} loading
                        </span>
                      </>
                    )}
                    {!isLoading && searchDurationMs !== null && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500">
                          {searchDurationMs < 1000
                            ? `${searchDurationMs}ms`
                            : searchDurationMs < 2000
                              ? `${(searchDurationMs / 1000).toFixed(1)}s`
                              : `${Math.round(searchDurationMs / 1000)}s`}
                        </span>
                      </>
                    )}
                  </div>
                  {/* ⌘K kbd hint — opens the command palette. Hidden
                      below sm so the search bar gets the room. The
                      visible "K" chip mirrors the long-standing
                      keyboard contract from ShortcutHelpModal. */}
                  <button
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT))
                    }
                    className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-md text-slate-500 hover:text-indigo-700 hover:bg-white/60 transition-colors flex-shrink-0"
                    title="Open command palette (⌘K)"
                    aria-label="Open command palette"
                  >
                    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-indigo-200 bg-white/80 font-mono text-[10px] text-slate-600">
                      ⌘
                    </kbd>
                    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded border border-indigo-200 bg-white/80 font-mono text-[10px] text-slate-600">
                      K
                    </kbd>
                  </button>
                  <button
                    onClick={handleClear}
                    className="font-mono text-[11px] uppercase tracking-[0.08em] text-slate-500 hover:text-indigo-700 transition-colors px-2 py-1.5 rounded-md hover:bg-white/60 flex-shrink-0"
                    title="Clear search and return home"
                  >
                    Clear
                  </button>
                </div>
                {/* Sticky progress bar.
                    - When we have a real progress signal (pendingSources
                      strictly between 0 and total) we render the
                      determinate bar with the existing width transition.
                    - When we're at the very start (every source still
                      pending) or end (last source landed but state hasn't
                      cleared yet) we swap to an indeterminate left-to-right
                      shuttle so the user sees motion the whole time the
                      sticky bar reads "loading" rather than a dead 4%
                      stub. */}
                {isLoading && (
                  <div
                    className={`ts-sticky-progress${
                      progressPct > 4 && progressPct < 100 ? "" : " indeterminate"
                    }`}
                    aria-hidden
                  >
                    <span
                      style={
                        progressPct > 4 && progressPct < 100
                          ? { width: `${progressPct}%` }
                          : undefined
                      }
                    />
                  </div>
                )}
              </motion.header>

              <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 w-full">
                {isLoading && resultCount === 0 ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.08em] text-slate-500 tabular-nums">
                      <span>
                        Searching <span className="text-slate-700 font-semibold">{activeSources}</span> sources
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        {pendingSourceList.slice(0, 10).map((src) => {
                          const cfg = getSourceConfig(src);
                          const Icon = cfg.lucideIcon;
                          return (
                            <span
                              key={src}
                              title={cfg.name}
                              className="inline-flex animate-pulse"
                              aria-hidden
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                          );
                        })}
                        {pendingSourceList.length > 10 && (
                          <span className="text-slate-400">
                            +{pendingSourceList.length - 10}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="grid gap-5 lg:gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <CardSkeleton key={i} sparse={skeletonsShouldBeSparse} />
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
                      emptySources={emptySources}
                    />

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
                      <p className="text-[12.5px] text-slate-500 font-mono tabular-nums tracking-[0.01em]">
                        <span className="text-slate-800 font-semibold">{view.length}</span>{" "}
                        <span className="uppercase text-[11px] tracking-[0.06em] text-slate-400">
                          {view.length === 1 ? "result" : "results"}
                        </span>
                        {activeSourceFilter && (
                          <span>
                            <span className="text-slate-300 mx-1.5">·</span>
                            <span className="uppercase text-[11px] tracking-[0.06em] text-slate-400">
                              from
                            </span>{" "}
                            <span className="text-indigo-700 font-semibold">
                              {getSourceConfig(activeSourceFilter).name}
                            </span>
                          </span>
                        )}
                        {parsedQuery.freeText && (
                          <span>
                            <span className="text-slate-300 mx-1.5">·</span>
                            <span className="uppercase text-[11px] tracking-[0.06em] text-slate-400">
                              for
                            </span>{" "}
                            <span className="text-indigo-700 font-semibold normal-case">
                              {parsedQuery.freeText}
                            </span>
                          </span>
                        )}
                        {opSummary && (
                          <span>
                            <span className="text-slate-300 mx-1.5">·</span>
                            <span className="text-slate-600 text-[11px] normal-case">
                              {opSummary}
                            </span>
                          </span>
                        )}
                      </p>

                      {/* Failed-sources indicator: a quiet ghost pill that
                          appears only when one or more sources errored
                          (and at least one source delivered, otherwise the
                          full retry card below would be showing). Click
                          opens a tray listing which sources failed so the
                          user can decide whether to retry or ignore. */}
                      <NetworkErrorTray
                        failedSources={failedSources}
                        open={failedTrayOpen}
                        onToggle={() => setFailedTrayOpen((v) => !v)}
                        onRetry={() => {
                          setFailedTrayOpen(false);
                          handleSearch(query || lastSubmittedRef.current);
                        }}
                      />
                    </div>

                    <AnimatedGrid
                      ref={resultsGridRef}
                      keyed={query || parsedQuery.freeText}
                      className="grid gap-5 lg:gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr"
                    >
                      {view.map((project, idx) => (
                        // UnifiedProjectCard's inner AnimatedCard is the
                        // single motion.div per card — focus-ring class
                        // and the data-result-card / data-result-id /
                        // data-result-url keyboard-nav attrs are hoisted
                        // through `outerClassName` props so we only mount
                        // one motion node per result instead of two
                        // (wrapper + AnimatedCard). Filter-change exit
                        // now uses cardVariants.exit (scale 0.94) which
                        // is shared with the rest of the entry/exit
                        // vocabulary.
                        <UnifiedProjectCard
                          key={project.id}
                          project={project}
                          index={idx}
                          onToast={showToast}
                          onTopicClick={(topic) => handleSearch(topic)}
                          outerClassName={`transition-shadow rounded-[18px] ${
                            focusedIdx === idx
                              ? "ring-2 ring-indigo-500/60 ring-offset-2 ring-offset-transparent"
                              : ""
                          }`}
                        />
                      ))}
                    </AnimatedGrid>

                    {/* Escape hatch when the user wants more than ThreadSeeker's
                        top-ranked slice from a single source. */}
                    {activeSourceFilter && query && getSourceSearchUrl(activeSourceFilter, query) && (() => {
                      const cfg = getSourceConfig(activeSourceFilter);
                      const Icon = cfg.lucideIcon;
                      return (
                        <div className="flex justify-center pt-6">
                          <a
                            href={getSourceSearchUrl(activeSourceFilter, query) || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3.5 py-1.5 transition-colors"
                          >
                            <Icon className="w-3.5 h-3.5" aria-hidden />
                            <span>See all on {cfg.name}</span>
                            <ArrowRight className="w-3 h-3" aria-hidden />
                          </a>
                        </div>
                      );
                    })()}

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
                          <div className="text-center ts-section-header mb-2.5">
                            {"// More from"}
                          </div>
                          <div className="flex flex-wrap justify-center gap-2">
                            {top.map((src) => {
                              const cfg = getSourceConfig(src);
                              const Icon = cfg.lucideIcon;
                              return (
                                <a
                                  key={src}
                                  href={getSourceSearchUrl(src, parsedQuery.freeText) || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3.5 py-1.5 transition-colors"
                                >
                                  <Icon className="w-3.5 h-3.5" aria-hidden />
                                  <span>{cfg.name}</span>
                                  <ArrowRight className="w-3 h-3" aria-hidden />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : hasSearched && lastSearchedCount > 0 && failedSources.length === lastSearchedCount ? (
                  // Network failure: every queried source errored out and we
                  // have no results at all. Show a friendlier "couldn't
                  // reach sources" card with a one-tap retry rather than
                  // the generic empty state — feels less like a dead end
                  // and more like a known transient condition.
                  <NetworkErrorMessage
                    sourceCount={lastSearchedCount}
                    onRetry={() => handleSearch(query || lastSubmittedRef.current)}
                    onClear={handleClear}
                  />
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
                    {(() => {
                      const dropOneTerm = () => {
                        const tokens = parsedQuery.freeText.split(/\s+/).filter(Boolean);
                        const stop = new Set(["the", "a", "an", "for", "to", "of", "in", "on"]);
                        const candidates = tokens.filter((t) => !stop.has(t.toLowerCase()));
                        const victim = candidates.sort((a, b) => a.length - b.length)[0] ?? tokens[0];
                        const next = tokens.filter((t) => t !== victim).join(" ");
                        if (next.trim()) handleSearch(next);
                      };
                      type Action = {
                        key: string;
                        label: ReactNode;
                        shortLabel: string; // compact mobile-primary copy
                        onClick: () => void;
                        href?: string;
                      };
                      const ghQ = encodeURIComponent(parsedQuery.freeText || query);
                      const actions: Action[] = [];
                      if (describeOperators(parsedQuery)) {
                        actions.push({
                          key: "filters",
                          label: (
                            <>
                              Drop filters:{" "}
                              <span className="font-mono text-slate-500">
                                {describeOperators(parsedQuery)}
                              </span>
                            </>
                          ),
                          shortLabel: "Drop filters",
                          onClick: () => handleSearch(parsedQuery.freeText || query),
                        });
                      }
                      if (selectedSources.length < ALL_SOURCES.length) {
                        actions.push({
                          key: "sources",
                          label: `Search all ${ALL_SOURCES.length} sources`,
                          shortLabel: `Search all ${ALL_SOURCES.length} sources`,
                          onClick: () => {
                            setSelectedSources(ALL_SOURCES);
                            handleSearch(query);
                          },
                        });
                      }
                      if (
                        parsedQuery.freeText &&
                        parsedQuery.freeText.split(/\s+/).length > 1
                      ) {
                        actions.push({
                          key: "term",
                          label: "Drop one term",
                          shortLabel: "Drop one term",
                          onClick: dropOneTerm,
                        });
                      }
                      actions.push({
                        key: "github",
                        label: (
                          <>
                            Search GitHub directly <ArrowRight className="w-3 h-3" aria-hidden />
                          </>
                        ),
                        shortLabel: "Search GitHub",
                        onClick: () => {},
                        href: `https://github.com/search?q=${ghQ}&type=repositories`,
                      });
                      const [primary, ...secondary] = actions;
                      const pillClass =
                        "text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3 sm:px-3.5 py-1.5 transition-colors inline-flex items-center justify-center gap-1";
                      // Beyond the first 2 secondary pills, hide on narrow
                      // mobile (≤sm) so the row stays one line on iPhone-SE
                      // 320px width. Desktop still gets the full set. Power
                      // users on phones still reach extras via the gradient
                      // primary CTA above.
                      const SECONDARY_MOBILE_VISIBLE = 2;
                      // Canonical primary-CTA look: extends the .btn-primary
                      // utility (which already wires --ts-accent-gradient),
                      // overriding only the shape/width so it reads as a
                      // full-width phone CTA rather than a 36px button.
                      const primaryMobileClass =
                        "sm:hidden btn btn-primary w-full rounded-full h-11 text-[13px]";
                      const renderPill = (a: Action, extra = "") =>
                        a.href ? (
                          <a
                            key={a.key}
                            href={a.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${pillClass} ${extra}`}
                          >
                            {a.label}
                          </a>
                        ) : (
                          <button
                            key={a.key}
                            onClick={a.onClick}
                            className={`${pillClass} ${extra}`}
                          >
                            {a.label}
                          </button>
                        );
                      return (
                        <div className="mt-6 w-full max-w-md mx-auto flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-center gap-2">
                          {/* Mobile-only promoted primary (full-width gradient CTA). */}
                          {primary.href ? (
                            <a
                              href={primary.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={primaryMobileClass}
                            >
                              {primary.shortLabel}
                              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                            </a>
                          ) : (
                            <button onClick={primary.onClick} className={primaryMobileClass}>
                              {primary.shortLabel}
                              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                            </button>
                          )}
                          {/* Full set — visible sm+, with the primary duplicated
                              there as a ghost pill so the desktop row keeps its
                              meaning. On mobile the secondary actions still
                              appear as smaller pills below the CTA, but capped
                              at SECONDARY_MOBILE_VISIBLE so 320px-wide phones
                              don't wrap to 2 lines. */}
                          {renderPill(primary, "hidden sm:inline-flex")}
                          {secondary.map((a, i) =>
                            renderPill(
                              a,
                              i >= SECONDARY_MOBILE_VISIBLE ? "hidden sm:inline-flex" : "",
                            ),
                          )}
                          <button
                            onClick={handleClear}
                            className="text-[12.5px] font-medium text-slate-500 hover:text-indigo-700 transition-colors px-3.5 py-1.5"
                          >
                            Back to home
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t border-indigo-100/70">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6 text-[12px] text-slate-500">
          <div className="leading-relaxed flex items-center gap-3 flex-wrap">
            <BrandMark variant="inline" />
            <span className="text-slate-300">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] tabular-nums">
              <span className="text-slate-700 font-semibold">{ALL_SOURCES.length}</span>{" "}
              <span className="text-slate-400">platforms</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-slate-400">
              No paid APIs
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-slate-400">
              No tracking
            </span>
          </div>
          <div className="flex items-center gap-4 md:flex-shrink-0 font-mono text-[11px] uppercase tracking-[0.08em]">
            <a
              href="https://github.com/PrivateVictories-Main/threadseeker"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-indigo-700 transition-colors text-slate-500"
            >
              <Github className="w-3.5 h-3.5" aria-hidden />
              GitHub
            </a>
            <span className="text-slate-300 normal-case">·</span>
            <span className="inline-flex items-center gap-1.5 normal-case text-slate-500 lowercase">
              <span className="uppercase">Press</span>
              <kbd className="px-1.5 py-0.5 rounded border border-indigo-200 bg-white text-slate-700 font-mono text-[11px] uppercase">
                ?
              </kbd>
              <span className="uppercase">for shortcuts</span>
            </span>
          </div>
        </div>
      </footer>
      <Toast message={toastMessage} />
      <ShortcutHelpButton visible={mode === "results"} />
    </div>
  );
}
