"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { SearchBar } from "@/components/SearchBar";
import { UnifiedProjectCard } from "@/components/UnifiedProjectCard";
import { SourceFilter } from "@/components/SourceFilter";
import { SynthesisBox } from "@/components/SynthesisBox";
import { ResultsToolbar, SortMode, applyResultsView } from "@/components/ResultsToolbar";
import { searchAllSources, UnifiedProject, SourceType } from "@/lib/sources";
import { optimizeQueries, isBackendConfigured } from "@/lib/api-client";
import { toast } from "sonner";
import { Search, Globe, ArrowRight } from "lucide-react";

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
  "paperswithcode",
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
  const [hasSearched, setHasSearched] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(ALL_SOURCES);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [activeSourceFilter, setActiveSourceFilter] = useState<SourceType | null>(null);
  const initialLoadDone = useRef(false);
  const searchRunIdRef = useRef(0);

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      const q = searchQuery.trim();
      if (!q) return;

      // Bump run id so stale progress events from an older search are ignored.
      searchRunIdRef.current += 1;
      const runId = searchRunIdRef.current;

      setQuery(q);
      setProjects([]);
      setIsLoading(true);
      setPendingSources(selectedSources.length);
      setHasSearched(true);
      setActiveSourceFilter(null);
      setSortMode("relevance");

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
        // Final authoritative sort once everything is in.
        setProjects(results);

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
        }
      }
    },
    [selectedSources]
  );

  // Read ?q= and ?sources= from URL on first mount and auto-search.
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get("q")?.trim();
    const urlSources = params.get("sources");

    if (urlSources) {
      const parsed = urlSources
        .split(",")
        .filter((s): s is SourceType => (ALL_SOURCES as string[]).includes(s));
      if (parsed.length > 0) setSelectedSources(parsed);
    }

    if (urlQuery) {
      handleSearch(urlQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync with the active query + sources so results are shareable.
  useEffect(() => {
    if (!hasSearched) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    // Only write sources if the user has changed from the default "all".
    if (selectedSources.length !== ALL_SOURCES.length) {
      params.set("sources", selectedSources.join(","));
    }
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [query, selectedSources, hasSearched]);

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

          {/* Example queries — only on landing */}
          {!hasSearched && !isLoading && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
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
          )}
        </div>
      </section>

      {/* Results */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {isLoading && resultCount === 0 ? (
          <div className="space-y-4">
            <div className="text-sm text-slate-500">
              Searching {activeSources} sources...
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
                      still searching {pendingSources}{" "}
                      {pendingSources === 1 ? "source" : "sources"}…
                    </span>
                  )}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {view.map((project) => (
                    <UnifiedProjectCard key={project.id} project={project} />
                  ))}
                </div>
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
              Search across GitHub, npm, PyPI, Hugging Face, and more
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
