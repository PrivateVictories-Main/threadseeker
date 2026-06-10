"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { UnifiedProjectCard } from "@/components/UnifiedProjectCard";
import { ProjectListRow } from "@/components/ProjectListRow";
import { SourceFilter } from "@/components/SourceFilter";
import { ResultsToolbar, SortMode, SORT_MODES, applyResultsView } from "@/components/ResultsToolbar";
import { TrendingSection } from "@/components/TrendingSection";
import { CATEGORY_DEFS, type CategoryKey } from "@/components/CategoryNav";
import { FeaturedProjects } from "@/components/FeaturedProjects";
import { DirectJumps } from "@/components/DirectJumps";
import { RegistryJumps } from "@/components/RegistryJumps";
import { CardSkeleton } from "@/components/CardSkeleton";
import { CategoryGrid } from "@/components/CategoryGrid";
import { LandingHero } from "@/components/LandingHero";
import { LandingStatTiles } from "@/components/LandingStatTiles";
import { ShortcutHelpModal, ShortcutHelpButton } from "@/components/ShortcutHelpModal";
import { DiscoverRail } from "@/components/DiscoverRail";

// On-demand surfaces (opened by keystroke/click, never needed for first
// paint) load as their own chunks. ssr:false also keeps them out of the
// statically-exported HTML, where they rendered nothing anyway.
// (ShortcutHelpModal stays static: its module also exports the always-visible
// trigger button, so splitting the modal would not shrink the main chunk.)
const DetailDrawer = dynamic(
  () => import("@/components/card/DetailDrawer").then((m) => m.DetailDrawer),
  { ssr: false },
);
const CommandPalette = dynamic(
  () => import("@/components/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);
import { NetworkErrorMessage, NetworkErrorTray } from "@/components/network/NetworkErrorMessage";
import { AnimatedGrid } from "@/components/motion/AnimatedGrid";
import { Toast } from "@/components/motion/Toast";
import { CountUp } from "@/components/motion/CountUp";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { AppShell } from "@/components/shell/AppShell";
import { modeVariants } from "@/lib/motion";
import { safeHref } from "@/lib/utils";
// Registry-only import (display config + types): the heavy engine modules
// (adapters/synonyms/ranking) are loaded lazily by useSearch on idle, so the
// first paint ships none of them.
import {
  getSourceConfig,
  getSourceSearchUrl,
  ALL_SOURCE_TYPES,
  sparseFraction,
} from "@/lib/sources/registry";
import type { UnifiedProject, SourceType } from "@/lib/sources/types";
import { parseQuery, applyOperators, describeOperators } from "@/lib/query-parser";
import { SynthesisCard } from "@/components/SynthesisCard";
import { useSearch, loadHistory, saveHistory } from "./useSearch";
import { ArrowRight, SearchX, Github, LayoutGrid, List as ListIcon } from "lucide-react";


// Derived from the source registry (exhaustive by construction) — no
// hand-maintained array to drift when a source is added.
const ALL_SOURCES: SourceType[] = ALL_SOURCE_TYPES;

type ResultsView = "grid" | "list";

// The entire client app, extracted from app/page.tsx so BOTH routes can
// render it: / mounts it bare, and every /search/[slug] SEO landing mounts it
// pre-seeded via `initialQuery` (which behaves exactly like a ?q= deep link).
// Route page files must not import each other's default exports — Next's
// typegen constrains a page's props to PageProps — hence this shared module.
export function HomeApp({ initialQuery }: { initialQuery?: string }) {
  const heroHeadingLevel: "h1" | "h2" = initialQuery ? "h2" : "h1";
  // ── View / UI state. The page owns this; the search engine (result-domain
  // state + orchestration) lives in the useSearch hook below. ────────────────
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(ALL_SOURCES);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [activeSourceFilter, setActiveSourceFilter] = useState<SourceType | null>(null);
  const [failedTrayOpen, setFailedTrayOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sourceFilterOpen, setSourceFilterOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [drawerProject, setDrawerProject] = useState<UnifiedProject | null>(null);
  const [resultsView, setResultsView] = useState<ResultsView>("grid");
  // Iter-24 — briefly flash a card's id after opening its drawer (indigo ring).
  const [flashCardId, setFlashCardId] = useState<string | null>(null);
  // Iter-24 — inline "Sorted by …" toast on sort change (~1s).
  const [sortToastLabel, setSortToastLabel] = useState<string | null>(null);
  // Iter-24 — viewport-aware drawer-pinned state. On xl+ (≥1280px) the
  // DetailDrawer becomes a sticky right rail instead of a slide-over.
  const [viewportIsXl, setViewportIsXl] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 1280px)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = () => setViewportIsXl(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Reset the page's view state on a new search — handed to the search hook so
  // the engine can drive it without owning it (scroll-to-top + clear sort/
  // filter unless preserving + close the failed-source tray).
  const resetView = useCallback((preserveView: boolean) => {
    setFailedTrayOpen(false);
    if (!preserveView) {
      setActiveSourceFilter(null);
      setSortMode("relevance");
      if (typeof window !== "undefined" && window.scrollY > 0) {
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {
          window.scrollTo(0, 0);
        }
      }
    }
  }, []);

  // ── Search engine: result-domain state + the full search orchestration.
  // Destructured into the same names the JSX already uses. ───────────────────
  const {
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
    lastSubmittedRef,
    handleSearch,
    clearSearch,
    debouncedChangeHandler,
    handleHistoryRemove,
  } = useSearch({ selectedSources, resetView });

  const initialLoadDone = useRef(false);
  const resultsGridRef = useRef<HTMLDivElement | null>(null);

  const parsedQuery = useMemo(() => parseQuery(query), [query]);

  // Mode = hero (landing) vs results.
  const mode: "hero" | "results" = hasSearched || isLoading || projects.length > 0 ? "results" : "hero";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (!hasSearched) return;
      // Don't let grid nav (j/k/Enter/Esc) leak to the background while any
      // modal/drawer is open — otherwise Enter opens the background card and
      // Escape double-fires. The overlay's own focus trap owns the keyboard.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      const grid = resultsGridRef.current;
      if (!grid) return;
      const cards = grid.querySelectorAll<HTMLElement>("[data-result-card]");
      if (cards.length === 0) return;

      const scrollBehavior: ScrollBehavior = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
        ? "auto"
        : "smooth";

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => {
          const next = Math.min(cards.length - 1, i < 0 ? 0 : i + 1);
          cards[next]?.scrollIntoView({ block: "nearest", behavior: scrollBehavior });
          return next;
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => {
          const next = Math.max(0, i <= 0 ? 0 : i - 1);
          cards[next]?.scrollIntoView({ block: "nearest", behavior: scrollBehavior });
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

  const focusedIdRef = useRef<string | null>(null);


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
    const urlView = params.get("view");

    if (urlSources) {
      const parsed = urlSources
        .split(",")
        .filter((s): s is SourceType => (ALL_SOURCES as string[]).includes(s));
      if (parsed.length > 0) setSelectedSources(parsed);
    }

    if (urlSort && (SORT_MODES as readonly string[]).includes(urlSort)) {
      setSortMode(urlSort as SortMode);
    }

    if (urlFilter && (ALL_SOURCES as string[]).includes(urlFilter)) {
      setActiveSourceFilter(urlFilter as SourceType);
    }

    if (urlView === "list" || urlView === "grid") {
      setResultsView(urlView);
    }

    if (urlQuery) {
      handleSearch(urlQuery, true);
    } else if (initialQuery?.trim()) {
      // /search/[slug] landings auto-run their query on mount. ?q= still wins
      // above so a shared/edited URL keeps its meaning on those pages too.
      handleSearch(initialQuery.trim(), true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasSearched) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (selectedSources.length !== ALL_SOURCES.length) {
      params.set("sources", selectedSources.join(","));
    }
    if (sortMode !== "relevance") params.set("sort", sortMode);
    if (activeSourceFilter) params.set("filter", activeSourceFilter);
    if (resultsView !== "grid") params.set("view", resultsView);
    const qs = params.toString();
    // On a /search/[slug] landing whose auto-run query is still untouched,
    // keep the clean canonical URL — rewriting it to /search/foo/?q=foo
    // immediately after hydration would make every visit a non-canonical
    // variant. ACTIVELY rewrite to the bare pathname (not an early return):
    // a user who sets sort=stars and then reverts to defaults must see the
    // stale ?q=&sort= params cleaned up, not frozen in place.
    const isPristineLanding =
      initialQuery &&
      query === initialQuery.trim() &&
      qs === new URLSearchParams({ q: query }).toString();
    const newUrl = isPristineLanding
      ? window.location.pathname
      : qs
        ? `${window.location.pathname}?${qs}`
        : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [query, selectedSources, hasSearched, sortMode, activeSourceFilter, resultsView, initialQuery]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  }, []);

  // Stable card handlers — UnifiedProjectCard is memoized, so these must keep
  // their identity across the up-to-30 streaming re-renders per search or the
  // shallow compare can never skip a card.
  const handleTopicClick = useCallback(
    (topic: string) => handleSearch(topic),
    [handleSearch],
  );
  const handleOpenDetails = useCallback((p: UnifiedProject) => {
    setDrawerProject(p);
    setFlashCardId(p.id);
  }, []);

  // Iter-24 — clear the card-flash highlight after a short window so
  // the indigo ring fades out and the card returns to its rest state.
  useEffect(() => {
    if (!flashCardId) return;
    const handle = setTimeout(() => setFlashCardId(null), 700);
    return () => clearTimeout(handle);
  }, [flashCardId]);

  // Iter-24 — sort-toast auto-dismiss.
  useEffect(() => {
    if (!sortToastLabel) return;
    const handle = setTimeout(() => setSortToastLabel(null), 1100);
    return () => clearTimeout(handle);
  }, [sortToastLabel]);

  const handleCategoryChange = useCallback((key: CategoryKey) => {
    setActiveCategory(key);
    const def = CATEGORY_DEFS.find((c) => c.key === key);
    if (!def) return;
    if (def.sources === "all") {
      setSelectedSources(ALL_SOURCES);
    } else {
      const next = def.sources.filter((s): s is SourceType =>
        (ALL_SOURCES as string[]).includes(s),
      );
      if (next.length > 0) setSelectedSources(next);
    }
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
    // On a /search/[slug] landing, "clear" means LEAVE the landing: staying
    // on the slug path would show the hero under the stale server-rendered
    // SEO band for the just-cleared query, and a reload would re-run it.
    // A real navigation to "/" unmounts the slug page (band included).
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/search/")) {
      window.location.href = "/";
      return;
    }
    // Reset the search domain (state + run-id + abort + history pointer) via
    // the hook, then the page's own view state + the URL.
    clearSearch();
    setActiveSourceFilter(null);
    setSortMode("relevance");
    window.history.replaceState(null, "", window.location.pathname);
  }, [clearSearch]);


  const activeSources = selectedSources.length;
  const resultCount = projects.length;

  const skeletonsShouldBeSparse = sparseFraction(selectedSources) >= 0.6;

  const sortedView = useMemo(
    () => (mode === "results" ? applyResultsView(projects, sortMode, activeSourceFilter) : projects),
    [mode, projects, sortMode, activeSourceFilter],
  );
  const view = useMemo(
    () => applyOperators(sortedView, parsedQuery),
    [sortedView, parsedQuery],
  );
  const opSummary = describeOperators(parsedQuery);

  const viewIdToIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < view.length; i++) {
      map.set(view[i].id, i);
    }
    return map;
  }, [view]);

  useEffect(() => {
    if (focusedIdx < 0) {
      focusedIdRef.current = null;
      return;
    }
    const currentId = view[focusedIdx]?.id;
    if (focusedIdRef.current && currentId !== focusedIdRef.current) {
      const nextIdx = viewIdToIndex.get(focusedIdRef.current) ?? -1;
      setFocusedIdx(nextIdx);
      if (nextIdx < 0) focusedIdRef.current = null;
    } else if (currentId) {
      focusedIdRef.current = currentId;
    }
  }, [focusedIdx, view, viewIdToIndex]);

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
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-1.5 focus:text-xs focus:text-slate-900 focus:shadow-lg focus:border focus:border-indigo-300"
      >
        Skip to main content
      </a>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>
      <ShortcutHelpModal />
      <DetailDrawer
        project={drawerProject}
        open={!!drawerProject}
        onClose={() => setDrawerProject(null)}
      />
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

      <AppShell
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        history={history}
        onHistoryClick={(q) => handleSearch(q)}
        onHistoryRemove={handleHistoryRemove}
        query={query}
        isLoading={isLoading}
        onSearch={handleSearch}
        onDebouncedChange={debouncedChangeHandler}
        resultCount={view.length}
        pendingCount={pendingSources}
        totalQueriedCount={lastSearchedCount}
        durationMs={searchDurationMs}
        inResultsMode={mode === "results"}
        activeCategoryLabel={
          activeCategory !== "all"
            ? CATEGORY_DEFS.find((c) => c.key === activeCategory)?.label
            : undefined
        }
        drawerPinned={!!drawerProject && viewportIsXl}
        onClear={handleClear}
      >
        {/* popLayout (not "wait"): the exiting section pops out of flow so
            the incoming one paints in the SAME frame — submit → skeletons
            visible instantly, crossfading through the receding hero. */}
        <AnimatePresence mode="popLayout" initial={false}>
          {mode === "hero" ? (
            <motion.section
              key="hero"
              initial="heroEnter"
              animate="heroShow"
              exit="heroExit"
              variants={modeVariants}
              className="ts-landing"
              aria-label="ThreadSeeker landing"
            >
              {/* HERO CARD — glass panel ~50vh, headline + tagline, no
                  search bar (search is in the top bar). */}
              <LandingHero
                headingLevel={heroHeadingLevel}
                sourceCount={ALL_SOURCES.length}
                sources={ALL_SOURCES}
                onSearch={handleSearch}
                history={history}
              />

              {/* STAT TILES ROW — repurposed below the hero. */}
              <LandingStatTiles sourceCount={ALL_SOURCES.length} />

              {/* FEATURED PROJECTS ROW — curated horizontal stripe. */}
              <RevealOnScroll>
                <FeaturedProjects
                  onTopicClick={(t) => handleSearch(t)}
                  onOpenDetails={(p) => setDrawerProject(p)}
                  onToast={showToast}
                />
              </RevealOnScroll>

              {/* TRENDING THIS WEEK ROW. */}
              <RevealOnScroll>
                <TrendingSection onQueryClick={(q) => handleSearch(q)} />
              </RevealOnScroll>

              {/* BROWSE BY CATEGORY — visual 6-tile grid that maps to
                  the same categories the sidebar exposes. */}
              <RevealOnScroll>
                <CategoryGrid
                  activeKey={activeCategory}
                  onSelect={(k) => {
                    handleCategoryChange(k);
                    // Don't auto-search — selection narrows the source
                    // set so the user's next query honors it.
                  }}
                />
              </RevealOnScroll>

              {/* REGISTRY JUMPS — npm/PyPI/crates/Docker quick links. */}
              <RevealOnScroll className="ts-landing-row">
                <h2 className="ts-section-header">{"// Direct jumps"}</h2>
                <p className="text-[12.5px] text-slate-500 mt-1 mb-3">
                  Open a registry directly without going through ThreadSeeker.
                </p>
                <RegistryJumps />
              </RevealOnScroll>

              {/* SOURCES — collapsible disclosure, kept for power users. */}
              <div className="ts-landing-row">
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
                  <div className="mt-3">
                    <SourceFilter
                      allSources={ALL_SOURCES}
                      selectedSources={selectedSources}
                      onToggle={handleSourceToggle}
                      onSetSelected={(next) => {
                        if (next.length > 0) setSelectedSources(next);
                      }}
                      onClear={() => setSelectedSources(ALL_SOURCES)}
                    />
                  </div>
                )}
              </div>

              <footer className="ts-landing-footer">
                <div className="ts-landing-footer-row">
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] tabular-nums">
                    <span className="text-slate-700 font-semibold">
                      {ALL_SOURCES.length}
                    </span>{" "}
                    <span className="text-slate-400">platforms</span>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-slate-400">
                    No paid APIs
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-slate-400">
                    No tracking
                  </span>
                </div>
                <div className="ts-landing-footer-row">
                  <a
                    href="https://github.com/PrivateVictories-Main/threadseeker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-indigo-700 transition-colors text-slate-500"
                  >
                    <Github className="w-3.5 h-3.5" aria-hidden />
                    GitHub
                  </a>
                </div>
              </footer>
            </motion.section>
          ) : (
            <motion.section
              key="results"
              initial="resultsEnter"
              animate="resultsShow"
              exit="resultsExit"
              variants={modeVariants}
              className="ts-results"
              aria-label="Search results"
            >
              <div className="ts-results-inner">
                {isLoading && resultCount === 0 ? (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11.5px] uppercase tracking-[0.08em] text-slate-500 tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" aria-hidden />
                        Searching{" "}
                        <span className="text-indigo-700 font-semibold">
                          {activeSources - pendingSources}
                        </span>{" "}
                        of{" "}
                        <span className="text-slate-700 font-semibold">
                          {activeSources}
                        </span>{" "}
                        sources
                        <span className="ts-loading-dots" aria-hidden />
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
                    <div className="grid gap-5 lg:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2560px]:grid-cols-6 auto-rows-fr">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <CardSkeleton
                          key={i}
                          sparse={skeletonsShouldBeSparse}
                          index={i}
                        />
                      ))}
                    </div>
                  </div>
                ) : resultCount > 0 ? (
                  <div className="space-y-4">
                    {/* Iter-24 — query echo banner. Big mono `// SEARCHING "..."`
                        head so the user always knows what query produced the
                        current results. */}
                    {(parsedQuery.freeText || query).trim().length > 0 && (
                      <div className="ts-results-query" aria-live="polite">
                        <span className="ts-results-query-label">{"// SEARCHING"}</span>
                        <span className="ts-results-query-term">
                          &ldquo;{parsedQuery.freeText || query}&rdquo;
                        </span>
                      </div>
                    )}

                    {/* Iter-24 — active filter chips row. Surfaces every
                        currently-applied narrowing (category, source, sort,
                        operators) with a one-click clear on each. */}
                    {(activeCategory !== "all" ||
                      activeSourceFilter ||
                      sortMode !== "relevance" ||
                      opSummary) && (
                      <div className="ts-active-filters" role="region" aria-label="Active filters">
                        <span className="ts-active-filters-label">{"// FILTERS"}</span>
                        {activeCategory !== "all" && (
                          <span className="ts-active-chip">
                            <span className="ts-active-chip-key">Category</span>
                            <span>{CATEGORY_DEFS.find((c) => c.key === activeCategory)?.label ?? activeCategory}</span>
                            <button
                              type="button"
                              className="ts-active-chip-x"
                              onClick={() => handleCategoryChange("all")}
                              aria-label="Clear category filter"
                              title="Clear"
                            >
                              <SearchX className="w-3 h-3" aria-hidden />
                            </button>
                          </span>
                        )}
                        {activeSourceFilter && (
                          <span className="ts-active-chip">
                            <span className="ts-active-chip-key">Source</span>
                            <span>{getSourceConfig(activeSourceFilter).name}</span>
                            <button
                              type="button"
                              className="ts-active-chip-x"
                              onClick={() => setActiveSourceFilter(null)}
                              aria-label="Clear source filter"
                              title="Clear"
                            >
                              <SearchX className="w-3 h-3" aria-hidden />
                            </button>
                          </span>
                        )}
                        {sortMode !== "relevance" && (
                          <span className="ts-active-chip">
                            <span className="ts-active-chip-key">Sort</span>
                            <span>{sortMode}</span>
                            <button
                              type="button"
                              className="ts-active-chip-x"
                              onClick={() => setSortMode("relevance")}
                              aria-label="Reset sort"
                              title="Clear"
                            >
                              <SearchX className="w-3 h-3" aria-hidden />
                            </button>
                          </span>
                        )}
                        {opSummary && (
                          <span className="ts-active-chip" title="Search operators">
                            <span className="ts-active-chip-key">Ops</span>
                            <span className="font-mono">{opSummary}</span>
                          </span>
                        )}
                        <button
                          type="button"
                          className="ts-active-chip-clear"
                          onClick={() => {
                            setActiveSourceFilter(null);
                            setSortMode("relevance");
                            handleCategoryChange("all");
                          }}
                          title="Clear all filters"
                        >
                          Clear all
                        </button>
                      </div>
                    )}

                    <SynthesisCard verdict={synthesis} loading={synthLoading} />

                    <DirectJumps query={parsedQuery.freeText || query} />

                    <div className="ts-results-toolbar-row">
                      <ResultsToolbar
                        projects={projects}
                        sortMode={sortMode}
                        onSortChange={(m) => {
                          setSortMode(m);
                          setSortToastLabel(
                            m === "relevance"
                              ? "Sorted by relevance"
                              : m === "stars"
                                ? "Sorted by stars"
                                : m === "updated"
                                  ? "Sorted by updated"
                                  : "Sorted by downloads",
                          );
                        }}
                        activeSource={activeSourceFilter}
                        onSourceClick={setActiveSourceFilter}
                        emptySources={emptySources}
                      />
                      <ViewToggle view={resultsView} onChange={setResultsView} />
                      {sortToastLabel && (
                        <motion.span
                          className="ts-sort-toast"
                          initial={{ opacity: 0, scale: 0.9, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 360, damping: 24 }}
                          aria-live="polite"
                        >
                          {sortToastLabel}
                        </motion.span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
                      <p className="text-[12.5px] text-slate-500 font-mono tabular-nums tracking-[0.01em]">
                        <span className="text-slate-800 font-semibold"><CountUp value={view.length} /></span>{" "}
                        <span className="uppercase text-[11px] tracking-[0.06em] text-slate-400">
                          {view.length === 1 ? "result" : "results"}
                        </span>
                        {!isLoading && lastSearchedCount > 0 && (
                          <>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span className="uppercase text-[11px] tracking-[0.06em] text-slate-400">
                              {lastSearchedCount === 1 ? "1 source searched" : `${lastSearchedCount} sources searched`}
                            </span>
                          </>
                        )}
                        {searchDurationMs !== null && !isLoading && (
                          <>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span className="uppercase text-[11px] tracking-[0.06em] text-slate-400">
                              {searchDurationMs < 1000
                                ? `${searchDurationMs}ms`
                                : `${(searchDurationMs / 1000).toFixed(1)}s`}
                            </span>
                          </>
                        )}
                        {/* Keyless in-browser semantic rerank status — quiet
                            confirmation that results are ordered by MEANING,
                            not just keywords. Hidden when unavailable. */}
                        {(semanticState === "scoring" || semanticState === "applied") && (
                          <>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span
                              className={`ts-semantic-pill${semanticState === "scoring" ? " is-scoring" : ""}`}
                              title="Results re-ranked by meaning — a small embedding model running in your browser, free, no API"
                            >
                              ✦ deep match{semanticState === "scoring" ? "…" : ""}
                            </span>
                          </>
                        )}
                        {activeSourceFilter && (
                          <span>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span className="uppercase text-[11px] tracking-[0.06em] text-slate-400">
                              from
                            </span>{" "}
                            <span className="text-indigo-700 font-semibold">
                              {getSourceConfig(activeSourceFilter).name}
                            </span>
                          </span>
                        )}
                        {opSummary && (
                          <span>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span className="text-slate-600 text-[11px] normal-case">
                              {opSummary}
                            </span>
                          </span>
                        )}
                      </p>

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

                    {/* Iter-25 / Overhaul K — Track 3 edge case: when
                        activeSourceFilter is set and that source returned
                        zero projects (but other sources had results),
                        view.length is 0 but resultCount > 0. Surface a
                        targeted callout that suggests pivoting to the
                        sources that DO have results, rather than letting
                        the user stare at an empty grid. */}
                    {activeSourceFilter && view.length === 0 && projects.length > 0 && (() => {
                      const counts = new Map<SourceType, number>();
                      for (const p of projects) {
                        counts.set(p.source, (counts.get(p.source) ?? 0) + 1);
                      }
                      const altSources = [...counts.entries()]
                        .filter(([s]) => s !== activeSourceFilter)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);
                      return (
                        <div className="ts-discover-rail">
                          <div className="ts-discover-head">
                            <h2 className="ts-section-header">
                              {"// Nothing on "}
                              <strong>{getSourceConfig(activeSourceFilter).name}</strong>
                            </h2>
                            <p className="ts-discover-banner">
                              {projects.length} result{projects.length === 1 ? "" : "s"} on other sources — pivot to one of these:
                            </p>
                          </div>
                          <div className="ts-discover-section">
                            <span className="ts-discover-label">Try</span>
                            <div className="ts-discover-chips">
                              {altSources.map(([src, n]) => {
                                const cfg = getSourceConfig(src);
                                return (
                                  <button
                                    key={src}
                                    type="button"
                                    onClick={() => setActiveSourceFilter(src)}
                                    className="ts-discover-chip"
                                    title={`Switch to ${cfg.name}`}
                                  >
                                    {cfg.name}
                                    <span className="text-slate-400 ml-1 tabular-nums text-[11px]">
                                      ({n})
                                    </span>
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => setActiveSourceFilter(null)}
                                className="ts-discover-chip is-primary"
                                title="Clear source filter"
                              >
                                Show all sources
                                <ArrowRight className="w-3 h-3 ml-1" aria-hidden />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Result list — grid OR list view. Iter-24:
                        view swap is wrapped in AnimatePresence so the
                        outgoing layout fades + drifts out before the
                        new layout fades in (instead of snapping). */}
                    <AnimatePresence mode="wait" initial={false}>
                      {resultsView === "list" ? (
                        <motion.div
                          key="list-view"
                          ref={resultsGridRef}
                          className="ts-result-list"
                          role="list"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0, transition: { duration: 0.22 } }}
                          exit={{ opacity: 0, y: -8, transition: { duration: 0.16 } }}
                        >
                          {view.map((project, idx) => (
                            <ProjectListRow
                              key={project.id}
                              project={project}
                              index={idx}
                              query={parsedQuery.freeText || query}
                              onToast={showToast}
                              onTopicClick={(topic) => handleSearch(topic)}
                              onOpenDetails={(p) => {
                                setDrawerProject(p);
                                setFlashCardId(p.id);
                              }}
                              focused={focusedIdx === idx}
                              flashId={flashCardId}
                            />
                          ))}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="grid-view"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0, transition: { duration: 0.22 } }}
                          exit={{ opacity: 0, y: -8, transition: { duration: 0.16 } }}
                        >
                          <AnimatedGrid
                            ref={resultsGridRef}
                            keyed={query || parsedQuery.freeText}
                            className="grid gap-5 lg:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2560px]:grid-cols-6 auto-rows-fr"
                          >
                            {view.map((project, idx) => (
                              <UnifiedProjectCard
                                key={project.id}
                                project={project}
                                index={idx}
                                query={parsedQuery.freeText || query}
                                onToast={showToast}
                                onTopicClick={handleTopicClick}
                                onOpenDetails={handleOpenDetails}
                                outerClassName={`transition-shadow rounded-[22px] ${
                                  focusedIdx === idx
                                    ? "ring-2 ring-indigo-500/60 ring-offset-2 ring-offset-transparent"
                                    : ""
                                } ${flashCardId === project.id ? "is-flash" : ""}`}
                              />
                            ))}
                          </AnimatedGrid>
                        </motion.div>
                      )}
                    </AnimatePresence>

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
                          <div className="text-center ts-section-header mb-3">
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

                    {/* Iter-25 / Overhaul K — Discover rail. Sparse-result
                        pages get the full glass card with Did-you-mean +
                        Related searches + Browse-by-tool. Dense pages get
                        a compact inline footer strip so the rail still
                        surfaces related queries without competing with
                        the (already-dense) results grid. */}
                    {!isLoading && (parsedQuery.freeText || query).trim().length > 0 && (
                      <DiscoverRail
                        query={parsedQuery.freeText || query}
                        banner={relaxationBanner}
                        relaxedQueries={relaxedQueries}
                        onQueryClick={(q) => handleSearch(q)}
                        variant={view.length < 9 ? "full" : "footer"}
                      />
                    )}
                  </div>
                ) : hasSearched && lastSearchedCount > 0 && failedSources.length === lastSearchedCount ? (
                  <NetworkErrorMessage
                    sourceCount={lastSearchedCount}
                    onRetry={() => handleSearch(query || lastSubmittedRef.current)}
                    onClear={handleClear}
                  />
                ) : hasSearched ? (
                  <div className="space-y-4">
                    {/* Iter-25 / Overhaul K — restyled no-results state.
                        Instead of a tiny centered SearchX in a sea of
                        whitespace, surface a slim banner that echoes
                        the query, then immediately the Discover rail
                        (Did-you-mean / Related searches / Browse-by-
                        tool) and finally the action pill row below. */}
                    {(parsedQuery.freeText || query).trim().length > 0 && (
                      <div className="ts-results-query" aria-live="polite">
                        <span className="ts-results-query-label">{"// SEARCHING"}</span>
                        <span className="ts-results-query-term">
                          &ldquo;{parsedQuery.freeText || query}&rdquo;
                        </span>
                      </div>
                    )}

                    <div className="ts-no-results-banner">
                      <span className="ts-no-results-headline">
                        {activeCategory !== "all"
                          ? `Nothing exact in ${CATEGORY_DEFS.find((c) => c.key === activeCategory)?.label ?? "this category"} — here are related projects`
                          : `No exact matches${(parsedQuery.freeText || query).trim() ? ` for "${parsedQuery.freeText || query}"` : ""} — here are related projects`}
                      </span>
                      <span className="ts-no-results-sub">
                        {activeCategory !== "all"
                          ? "Try widening to a different category, or browse all sources."
                          : "Browse the discover rail below for similar tools, or try one of the suggestions further down."}
                      </span>
                    </div>

                    {/* Discover rail — always shown on no-results so the
                        page is never visually empty. */}
                    {(parsedQuery.freeText || query).trim().length > 0 && (
                      <DiscoverRail
                        query={parsedQuery.freeText || query}
                        banner={relaxationBanner}
                        relaxedQueries={relaxedQueries}
                        onQueryClick={(q) => handleSearch(q)}
                        variant="full"
                      />
                    )}

                    {/* Iter-24 — category pivot chips on no-results.
                        Surfaces the immediate "try a different category"
                        flow as one-click chips. Only when a narrow
                        category is active. */}
                    {activeCategory !== "all" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.10em] text-slate-400 mr-1">
                          {"// Try"}
                        </span>
                        {(["all", "repos", "packages", "ai", "papers", "threads"] as const)
                          .filter((k) => k !== activeCategory)
                          .slice(0, 4)
                          .map((k) => {
                            const def = CATEGORY_DEFS.find((c) => c.key === k);
                            return (
                              <button
                                key={k}
                                type="button"
                                onClick={() => {
                                  handleCategoryChange(k);
                                  if (query) handleSearch(query);
                                }}
                                className="text-[12.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3.5 py-1.5 transition-colors inline-flex items-center gap-1.5"
                              >
                                <span>{def?.label ?? k}</span>
                                <ArrowRight className="w-3 h-3" aria-hidden />
                              </button>
                            );
                          })}
                      </div>
                    )}
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
                        shortLabel: string;
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
                      const SECONDARY_MOBILE_VISIBLE = 2;
                      const primaryMobileClass =
                        "sm:hidden btn btn-primary w-full rounded-full h-11 text-[13px]";
                      const renderPill = (a: Action, extra = "") =>
                        a.href ? (
                          <a
                            key={a.key}
                            href={safeHref(a.href)}
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
                        <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                          {primary.href ? (
                            <a
                              href={safeHref(primary.href)}
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
      </AppShell>

      <Toast message={toastMessage} />
      <ShortcutHelpButton visible={mode === "results"} />
    </>
  );
}

// ---------------------------------------------------------------------
// View toggle — Grid / List flip on the results sub-toolbar.
// ---------------------------------------------------------------------

function ViewToggle({
  view,
  onChange,
}: {
  view: ResultsView;
  onChange: (v: ResultsView) => void;
}) {
  // A group of toggle buttons, NOT a tablist: tabs imply tabpanels + roving
  // tabindex + arrow-key contract none of which apply to a view switcher.
  // aria-pressed on real buttons is the robust pattern — both stay in the
  // tab order and screen readers announce "Grid, toggle button, pressed".
  return (
    <div className="ts-view-toggle" role="group" aria-label="Result view">
      {(["grid", "list"] as const).map((kind) => {
        const Icon = kind === "grid" ? LayoutGrid : ListIcon;
        const active = view === kind;
        return (
          <motion.button
            key={kind}
            type="button"
            aria-pressed={active}
            className={`ts-view-toggle-btn has-layout-pill${active ? " is-active" : ""}`}
            onClick={() => onChange(kind)}
            title={`${kind === "grid" ? "Grid" : "List"} view`}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
          >
            {active && (
              <motion.span
                layoutId="ts-view-toggle-active-pill"
                className="ts-view-toggle-active-bg"
                aria-hidden
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 32,
                  mass: 0.7,
                }}
              />
            )}
            <Icon className="w-3.5 h-3.5" aria-hidden />
            <span>{kind === "grid" ? "Grid" : "List"}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
