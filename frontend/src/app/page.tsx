"use client";

import { useState, useEffect } from "react";
import { EnhancedSearchBar } from "@/components/EnhancedSearchBar";
import { UnifiedProjectCard } from "@/components/UnifiedProjectCard";
import { SourceDropdown } from "@/components/SourceDropdown";
import { searchAllSources, UnifiedProject, SourceType } from "@/lib/sources";
import { toast } from "sonner";
import { Sparkles, Brain, Zap, Shield, Layers, TrendingUp, Search } from "lucide-react";

export default function EnhancedHome() {
  const [projects, setProjects] = useState<UnifiedProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedSources, setSelectedSources] = useState<SourceType[]>([
    "github",
    "huggingface",
    "gitlab",
    "npm",
  ]);
  const [showingTrending, setShowingTrending] = useState(true);

  // Load trending projects on mount
  useEffect(() => {
    loadTrendingProjects();
  }, []);

  const loadTrendingProjects = async () => {
    setIsLoading(true);
    setShowingTrending(true);
    
    try {
      const allResults: UnifiedProject[] = [];
      
      // Define trending searches by source for better variety
      const trendingBySource = {
        github: [
          "react", "vue", "nextjs", "typescript", "python", 
          "rust", "go", "docker", "kubernetes", "vscode"
        ],
        huggingface: [
          "llm", "text-generation", "image-generation", "transformers"
        ],
        npm: [
          "react", "vue", "express", "next", "typescript"
        ],
        pypi: [
          "django", "fastapi", "pandas", "numpy", "tensorflow"
        ],
        gitlab: [
          "ci-cd", "devops", "kubernetes"
        ]
      };
      
      // Fetch from each source in parallel with shallow search (deepSearch=false)
      const promises: Promise<UnifiedProject[]>[] = [];
      
      // GitHub - 30 projects
      trendingBySource.github.forEach(query => {
        promises.push(
          searchAllSources(query, ["github"], false) // Shallow search for trending
            .then(results => results.slice(0, 3))
            .catch(() => [])
        );
      });
      
      // Hugging Face - 12 projects
      trendingBySource.huggingface.forEach(query => {
        promises.push(
          searchAllSources(query, ["huggingface"], false)
            .then(results => results.slice(0, 3))
            .catch(() => [])
        );
      });
      
      // npm - 10 projects
      trendingBySource.npm.forEach(query => {
        promises.push(
          searchAllSources(query, ["npm"], false)
            .then(results => results.slice(0, 2))
            .catch(() => [])
        );
      });
      
      // PyPI - 10 projects
      trendingBySource.pypi.forEach(query => {
        promises.push(
          searchAllSources(query, ["pypi"], false)
            .then(results => results.slice(0, 2))
            .catch(() => [])
        );
      });
      
      // GitLab - 6 projects
      trendingBySource.gitlab.forEach(query => {
        promises.push(
          searchAllSources(query, ["gitlab"], false)
            .then(results => results.slice(0, 2))
            .catch(() => [])
        );
      });
      
      const results = await Promise.all(promises);
      results.forEach(r => allResults.push(...r));
      
      // Remove duplicates and shuffle for variety
      const uniqueResults = Array.from(
        new Map(allResults.map(item => [item.id, item])).values()
      );
      
      // Shuffle to mix sources
      const shuffled = uniqueResults.sort(() => Math.random() - 0.5);
      
      // Take top 60
      const finalResults = shuffled.slice(0, 60);
      
      setProjects(finalResults);
      setTotalCount(finalResults.length);
    } catch (error) {
      console.error("Error loading trending projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setHasSearched(true);
    setShowingTrending(false);

    try {
      // Use deep search (true) for user queries to find the best results
      const results = await searchAllSources(query, selectedSources, true);
      setProjects(results);
      setTotalCount(results.length);
      
      if (results.length === 0) {
        toast.info("No results found. Try different keywords or sources.");
      } else {
        toast.success(`Found ${results.length} projects across ${selectedSources.length} sources!`);
      }
    } catch (error) {
      toast.error("Failed to search. Please try again.", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSourceToggle = (source: SourceType) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative border-b border-slate-800/50">
        <div className="relative pt-16 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Headline */}
            <div className="text-center space-y-3">
              <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-slate-100">
                Discover Open Source Projects
              </h1>
              <p className="text-sm text-slate-500 max-w-xl mx-auto">
                Search across multiple platforms with AI-powered insights
              </p>
            </div>

            {/* Search Interface */}
            <div className="max-w-3xl mx-auto space-y-3">
              <EnhancedSearchBar onSearch={handleSearch} isLoading={isLoading} />
              <div className="flex items-center justify-center gap-3">
                <SourceDropdown
                  selectedSources={selectedSources}
                  onSourceToggle={handleSourceToggle}
                />
                <span className="text-xs text-slate-600">•</span>
                <span className="text-xs text-slate-600">{totalCount} projects loaded</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="px-4 sm:px-6 lg:px-8 pb-24 pt-8">
        <div className="max-w-6xl mx-auto">
          {/* Results header */}
          {!isLoading && projects.length > 0 && (
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-medium text-slate-400">
                  {showingTrending ? "Trending" : "Results"}
                </h2>
                <span className="text-xs text-slate-600">
                  {totalCount.toLocaleString()} {totalCount === 1 ? "project" : "projects"}
                </span>
              </div>
              {showingTrending && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <TrendingUp className="w-3 h-3" />
                  <span>Updated daily</span>
                </div>
              )}
            </div>
          )}

          {/* Results grid */}
          {isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="h-56 rounded-lg bg-slate-900/30 animate-pulse border border-slate-800/50"
                />
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <UnifiedProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : hasSearched ? (
            <div className="text-center py-16">
              <Search className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No results found</p>
              <p className="text-xs text-slate-600 mt-1">Try different keywords or sources</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

