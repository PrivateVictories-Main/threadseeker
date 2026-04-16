"use client";

import { useState, useCallback } from "react";
import { SearchBar } from "@/components/SearchBar";
import { UnifiedProjectCard } from "@/components/UnifiedProjectCard";
import { SourceFilter } from "@/components/SourceFilter";
import { searchAllSources, UnifiedProject, SourceType } from "@/lib/sources";
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
  "hackernews",
  "reddit",
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
  const [hasSearched, setHasSearched] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(ALL_SOURCES);

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      const q = searchQuery.trim();
      if (!q) return;

      setQuery(q);
      setIsLoading(true);
      setHasSearched(true);

      try {
        const results = await searchAllSources(q, selectedSources, true);
        setProjects(results);

        if (results.length === 0) {
          toast.info("No results found. Try different keywords or enable more sources.");
        }
      } catch (error) {
        toast.error("Search failed. Please try again.");
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedSources]
  );

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
        {isLoading ? (
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {resultCount} {resultCount === 1 ? "result" : "results"}
                {query && (
                  <span className="text-slate-600">
                    {" "}
                    for <span className="text-slate-400">{query}</span>
                  </span>
                )}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <UnifiedProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
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
