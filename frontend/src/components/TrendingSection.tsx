"use client";

// Trending recently-created GitHub repos shown on the landing page.
// One unauthenticated call to api.github.com; result cached in sessionStorage
// for 30 min so tabbing back & forth doesn't burn the 10-rpm rate limit.

import { useEffect, useState } from "react";
import { Flame, Star, ArrowUpRight } from "lucide-react";

interface TrendingRepo {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  language: string | null;
}

const CACHE_KEY = "threadseeker:trending:v1";
const CACHE_TTL_MS = 30 * 60 * 1000;

function isoNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchTrending(): Promise<TrendingRepo[]> {
  const since = isoNDaysAgo(7);
  const params = new URLSearchParams({
    q: `created:>${since}`,
    sort: "stars",
    order: "desc",
    per_page: "8",
  });
  const res = await fetch(
    `https://api.github.com/search/repositories?${params}`,
    { headers: { Accept: "application/vnd.github.v3+json" } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((r: {
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    language: string | null;
  }) => ({
    name: r.name,
    fullName: r.full_name,
    url: r.html_url,
    description: r.description,
    stars: r.stargazers_count,
    language: r.language,
  }));
}

function loadCache(): TrendingRepo[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (typeof at !== "number" || Date.now() - at > CACHE_TTL_MS) return null;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function saveCache(data: TrendingRepo[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota, private mode — ignore */
  }
}

export function TrendingSection({ onQueryClick }: { onQueryClick?: (q: string) => void }) {
  const [repos, setRepos] = useState<TrendingRepo[] | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setRepos(cached);
      return;
    }
    let cancelled = false;
    fetchTrending()
      .then((data) => {
        if (cancelled) return;
        if (data.length === 0) {
          setErrored(true);
          return;
        }
        setRepos(data);
        saveCache(data);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (errored) return null;
  if (!repos) {
    return (
      <div className="mt-8">
        <div className="flex items-center justify-center gap-2 mb-3 text-[10px] uppercase tracking-wide text-slate-600">
          <Flame className="w-3 h-3" />
          Trending this week
        </div>
        <div className="grid gap-2 sm:grid-cols-2 max-w-2xl mx-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-md bg-slate-900/30 border border-slate-800/40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-center gap-2 mb-3 text-[10px] uppercase tracking-wide text-slate-600">
        <Flame className="w-3 h-3 text-amber-500/70" />
        Trending this week on GitHub
      </div>
      <div className="grid gap-2 sm:grid-cols-2 max-w-2xl mx-auto">
        {repos.slice(0, 6).map((r) => (
          <a
            key={r.fullName}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              // Option/alt-click: search for this repo name across all sources
              // instead of opening GitHub directly.
              if (e.altKey && onQueryClick) {
                e.preventDefault();
                onQueryClick(r.name);
              }
            }}
            className="group flex items-center justify-between gap-2 rounded-md bg-slate-900/40 hover:bg-slate-800/50 border border-slate-800/50 hover:border-slate-700/60 px-3 py-2 transition-colors"
            title={r.description ?? r.fullName}
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-300 group-hover:text-slate-100 truncate">
                {r.fullName}
              </div>
              {r.description && (
                <div className="text-[10px] text-slate-600 truncate mt-0.5">
                  {r.description}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <Star className="w-3 h-3" />
                {r.stars.toLocaleString()}
              </div>
              <ArrowUpRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
