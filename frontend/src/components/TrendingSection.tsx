"use client";

// Trending recently-created GitHub repos shown on the landing page, with a
// small language filter tab row. One unauthenticated call to api.github.com
// per language; result cached in sessionStorage for 30 min per language so
// tabbing back & forth doesn't burn the 10-rpm rate limit.

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

const CACHE_PREFIX = "threadseeker:trending:v2:";
const CACHE_TTL_MS = 30 * 60 * 1000;

const LANGUAGES = [
  { label: "All", value: "" },
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
  { label: "Rust", value: "rust" },
  { label: "Go", value: "go" },
] as const;

type LangKey = (typeof LANGUAGES)[number]["value"];

function isoNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchTrending(lang: LangKey): Promise<TrendingRepo[]> {
  const since = isoNDaysAgo(7);
  const q = lang ? `created:>${since} language:${lang}` : `created:>${since}`;
  const params = new URLSearchParams({
    q,
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

function cacheKey(lang: LangKey): string {
  return `${CACHE_PREFIX}${lang || "all"}`;
}

function loadCache(lang: LangKey): TrendingRepo[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(lang));
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (typeof at !== "number" || Date.now() - at > CACHE_TTL_MS) return null;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function saveCache(lang: LangKey, data: TrendingRepo[]) {
  try {
    sessionStorage.setItem(cacheKey(lang), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota, private mode — ignore */
  }
}

export function TrendingSection({ onQueryClick }: { onQueryClick?: (q: string) => void }) {
  const [lang, setLang] = useState<LangKey>("");
  const [repos, setRepos] = useState<TrendingRepo[] | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
    const cached = loadCache(lang);
    if (cached) {
      setRepos(cached);
      return;
    }
    setRepos(null);
    let cancelled = false;
    fetchTrending(lang)
      .then((data) => {
        if (cancelled) return;
        if (data.length === 0) {
          setErrored(true);
          return;
        }
        setRepos(data);
        saveCache(lang, data);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  return (
    <div className="glass section-container mt-8">
      <h2 className="section-title flex items-center justify-center gap-2">
        <Flame className="w-3 h-3 text-amber-500/70" />
        Trending this week on GitHub
      </h2>

      {/* Language tabs */}
      <div className="flex flex-wrap justify-center gap-1.5 mb-3">
        {LANGUAGES.map((l) => (
          <button
            key={l.value}
            onClick={() => setLang(l.value)}
            className={`text-[10px] rounded-full px-2.5 py-1 transition-colors border ${
              lang === l.value
                ? "border-slate-600 bg-slate-800/70 text-slate-200"
                : "border-slate-800/50 bg-slate-900/30 text-slate-500 hover:text-slate-300 hover:border-slate-700/60"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {errored ? (
        <p className="text-center text-[11px] text-slate-600">
          Couldn&apos;t fetch trending (rate limit — try again in a minute).
        </p>
      ) : !repos ? (
        <div className="grid gap-2 sm:grid-cols-2 max-w-2xl mx-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-md bg-slate-900/30 border border-slate-800/40 animate-pulse"
            />
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
}
