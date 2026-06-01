"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UnifiedProjectCard } from "@/components/UnifiedProjectCard";
import { ProjectListRow } from "@/components/ProjectListRow";
import { DetailDrawer } from "@/components/card/DetailDrawer";
import { SourceFilter } from "@/components/SourceFilter";
import { ResultsToolbar, SortMode, applyResultsView } from "@/components/ResultsToolbar";
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
import { CommandPalette } from "@/components/CommandPalette";
import { NetworkErrorMessage, NetworkErrorTray } from "@/components/network/NetworkErrorMessage";
import { AnimatedGrid } from "@/components/motion/AnimatedGrid";
import { Toast } from "@/components/motion/Toast";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { AppShell } from "@/components/shell/AppShell";
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
  nextRelaxation,
  type RelaxationTier,
  type RelaxedPlan,
} from "@/lib/sources";
import { parseQuery, applyOperators, describeOperators } from "@/lib/query-parser";
import { toast } from "sonner";
import { ArrowRight, SearchX, Github, LayoutGrid, List as ListIcon } from "lucide-react";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

type ResultsView = "grid" | "list";

export default function Home() {
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSources, setPendingSources] = useState(0);
  const [pendingSourceList, setPendingSourceList] = useState<SourceType[]>([]);
  const [failedSources, setFailedSources] = useState<SourceType[]>([]);
  const [lastSearchedCount, setLastSearchedCount] = useState(0);
  const [emptySources, setEmptySources] = useState<SourceType[]>([]);
  const [failedTrayOpen, setFailedTrayOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(ALL_SOURCES);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [activeSourceFilter, setActiveSourceFilter] = useState<SourceType | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sourceFilterOpen, setSourceFilterOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [drawerProject, setDrawerProject] = useState<UnifiedProject | null>(null);
  const [resultsView, setResultsView] = useState<ResultsView>("grid");
  // Iter-24 — when the user opens a card's details, briefly flash that
  // card's id so the corresponding ts-card / ts-list-row picks up an
  // indigo ring fade. Tracks "which card spawned the open drawer".
  const [flashCardId, setFlashCardId] = useState<string | null>(null);
  // Iter-24 — when the user changes sort, briefly show an inline toast
  // confirming the change ("Sorted by stars"). Mounts for ~1s.
  const [sortToastLabel, setSortToastLabel] = useState<string | null>(null);
  // Iter-25 / Overhaul K — when the resilience pipeline fired, store the
  // banner text so the Discover rail can announce "Showing related
  // results — no exact match for X". null when the strict pass had
  // enough results.
  const [relaxationBanner, setRelaxationBanner] = useState<string | null>(null);
  // Iter-25 / Overhaul K — record which relaxed-query strings were
  // actually executed, so the Discover rail can offer them as one-click
  // chips ("Did you mean autoclicker?").
  const [relaxedQueries, setRelaxedQueries] = useState<string[]>([]);
  // Iter-24 — viewport-aware drawer-pinned state. On xl+ (≥1280px) the
  // DetailDrawer becomes a sticky right rail instead of a slide-over
  // when there's a project to display. On smaller viewports we keep
  // the slide-over. Watched via matchMedia so live resizes work too.
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
  const initialLoadDone = useRef(false);
  const searchRunIdRef = useRef(0);
  const resultsGridRef = useRef<HTMLDivElement | null>(null);
  const lastSubmittedRef = useRef<string>("");

  const parsedQuery = useMemo(() => parseQuery(query), [query]);

  // Mode = hero (landing) vs results.
  const mode: "hero" | "results" = hasSearched || isLoading || projects.length > 0 ? "results" : "hero";

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

  const focusedIdRef = useRef<string | null>(null);

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

      setQuery(q);
      setProjects([]);
      setIsLoading(true);
      setSearchDurationMs(null);
      // Iter-24 — when the user fires a new search after scrolling
      // partway through results, scroll the main column back to the
      // top gracefully so the new result set lands in the viewport.
      // Skipped on initial mount-load (preserveView=true).
      if (!preserveView && typeof window !== "undefined" && window.scrollY > 0) {
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {
          window.scrollTo(0, 0);
        }
      }
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

      setHistory((prev) => {
        const next = [q, ...prev.filter((h) => h !== q)].slice(0, HISTORY_MAX);
        saveHistory(next);
        return next;
      });
      if (!preserveView) {
        setActiveSourceFilter(null);
        setSortMode("relevance");
      }

      // Iter-25 / Overhaul K — reset relaxation state at the start of every
      // search. The strict pass either fills the page on its own (state
      // stays null) or the post-strict resilience loop fills these.
      setRelaxationBanner(null);
      setRelaxedQueries([]);

      try {
        const expansion = expandQuery(freeText);
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
        const orExpanded = buildSearchQuery(freeText, expansion, { supportsOr: true });
        if (orExpanded !== freeText) {
          overrides.github = orExpanded;
          overrides.gitlab = orExpanded;
          overrides.codeberg = orExpanded;
        }

        const results = await searchAllSources(
          freeText,
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
        );

        if (searchRunIdRef.current !== runId) return;
        const mergedCorpus: UnifiedProject[] = results;
        const ranked = rankCorpus(mergeRelatedProjects(mergedCorpus), freeText, expansion);
        setProjects(ranked);

        // Iter-25 / Overhaul K — resilience loop. If the strict pass came
        // back thin, walk the relaxation chain (tokens → fuzzy-synonyms
        // → distinctive → first-token) until either we have enough
        // results or we exhaust the chain. Each plan calls
        // searchAllSources again with a broader query string and merges
        // into mergedCorpus. We dedupe by id so the same project doesn't
        // appear twice.
        const SATISFIED_AT = 9;
        if (ranked.length < SATISFIED_AT) {
          const seenIds = new Set(mergedCorpus.map((p) => p.id));
          const relaxedQueriesRun: string[] = [];
          let firstBanner: string | null = null;
          let lastTier: RelaxationTier = "strict";
          let cumulative = ranked.length;
          // Cap the chain so we don't fan out forever on truly-unique queries.
          for (let step = 0; step < 4; step += 1) {
            const plan: RelaxedPlan | null = nextRelaxation(freeText, cumulative, lastTier);
            if (!plan) break;
            // Skip if we've already executed this exact query string.
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
              relaxedOverrides.github = relaxedOr;
              relaxedOverrides.gitlab = relaxedOr;
              relaxedOverrides.codeberg = relaxedOr;
            }

            const relaxedResults = await searchAllSources(
              plan.query,
              targetSources,
              true,
              relaxedOverrides,
              // Don't update progress UI for relaxed passes — it would
              // confuse the "X of N sources" indicator. We've already
              // marked the strict pass as done.
              undefined,
            );
            if (searchRunIdRef.current !== runId) return;

            // Merge: append only items whose id isn't already present.
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
            cumulative = reranked.length;
            lastTier = plan.tier;
            if (cumulative >= SATISFIED_AT) break;
          }

          if (relaxedQueriesRun.length > 0) {
            setRelaxedQueries(relaxedQueriesRun);
            setRelaxationBanner(firstBanner);
          }
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

    if (urlSort && ["relevance", "stars", "recent"].includes(urlSort)) {
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
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [query, selectedSources, hasSearched, sortMode, activeSourceFilter, resultsView]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
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

  const handleHistoryRemove = useCallback((q: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== q);
      saveHistory(next);
      return next;
    });
  }, []);

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

  const debouncedChangeHandler = useCallback(
    (v: string) => {
      const trimmed = v.trim();
      if (!trimmed) return;
      if (trimmed === lastSubmittedRef.current) return;
      handleSearch(trimmed);
    },
    [handleSearch],
  );

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
        <AnimatePresence mode="wait" initial={false}>
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
              <LandingHero sourceCount={ALL_SOURCES.length} />

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
                    <div className="grid gap-5 lg:gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <CardSkeleton key={i} sparse={skeletonsShouldBeSparse} />
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
                        <span className="text-slate-800 font-semibold">{view.length}</span>{" "}
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
                            className="grid gap-5 lg:gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr"
                          >
                            {view.map((project, idx) => (
                              <UnifiedProjectCard
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
                        <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
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
  return (
    <div className="ts-view-toggle" role="tablist" aria-label="Result view">
      {(["grid", "list"] as const).map((kind) => {
        const Icon = kind === "grid" ? LayoutGrid : ListIcon;
        const active = view === kind;
        return (
          <motion.button
            key={kind}
            type="button"
            role="tab"
            aria-selected={active}
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
