"use client";

// Trending recently-created GitHub repos shown on the landing page, with a
// small language filter tab row. One unauthenticated call to api.github.com
// per language; result cached in sessionStorage for 30 min per language so
// tabbing back & forth doesn't burn the 10-rpm rate limit.

import { useEffect, useState } from "react";
import { Flame, Star, ArrowUpRight, RefreshCw } from "lucide-react";

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

function clearCache(lang: LangKey) {
  try {
    sessionStorage.removeItem(cacheKey(lang));
  } catch {
    /* private mode — ignore */
  }
}

export function TrendingSection({ onQueryClick }: { onQueryClick?: (q: string) => void }) {
  const [lang, setLang] = useState<LangKey>("");
  const [repos, setRepos] = useState<TrendingRepo[] | null>(null);
  const [errored, setErrored] = useState(false);
  // Bump to force a refetch (skipping the cache).
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    setErrored(false);
    if (retryNonce === 0) {
      const cached = loadCache(lang);
      if (cached) {
        setRepos(cached);
        return;
      }
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
  }, [lang, retryNonce]);

  return (
    <div className="glass section-container mt-12">
      <h2 className="section-title flex items-center justify-center gap-2">
        <Flame className="w-3 h-3 text-amber-600" aria-hidden />
        Trending this week
      </h2>

      {/* Language tabs — underline-bar active state for a tabbed-interface
          feel. Inactive pills are ghost (no chip background) so the row
          reads as segmented nav rather than a cluster of buttons. */}
      <div
        role="tablist"
        aria-label="Filter trending repos by language"
        className="ts-trending-tabs flex flex-wrap justify-center items-center gap-0.5 mb-5"
      >
        {LANGUAGES.map((l) => {
          const active = lang === l.value;
          return (
            <button
              key={l.value}
              role="tab"
              aria-selected={active}
              onClick={() => setLang(l.value)}
              className={`relative text-[11.5px] font-medium px-3 py-1.5 transition-colors ${
                active
                  ? "text-indigo-700"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {l.label}
              <span
                aria-hidden
                className={`pointer-events-none absolute left-2 right-2 -bottom-0.5 h-[2px] rounded-full transition-all ${
                  active
                    ? "bg-indigo-500 opacity-100 scale-x-100"
                    : "bg-indigo-400 opacity-0 scale-x-50"
                }`}
              />
            </button>
          );
        })}
      </div>

      {errored ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-center text-[12px] text-slate-500">
            Couldn&apos;t fetch trending (rate limit — try again in a minute).
          </p>
          <button
            type="button"
            onClick={() => {
              // Drop any persisted cache for this language before
              // refetching so retry hits the network instead of
              // silently re-rendering whatever stale (or post-error)
              // state lingered. The effect dep on retryNonce already
              // skips the in-flight cache read, but clearing the
              // sessionStorage entry guarantees the next fresh visit
              // also doesn't see ghost data if the retry itself fails.
              clearCache(lang);
              setRetryNonce((n) => n + 1);
            }}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-indigo-700 hover:text-indigo-800 transition-colors"
            aria-label="Retry fetching trending repos"
          >
            <RefreshCw className="w-3 h-3" aria-hidden />
            Try again
          </button>
        </div>
      ) : !repos ? (
        <div className="grid gap-1.5 sm:grid-cols-2 max-w-2xl mx-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[42px] rounded-xl bg-white/50 border border-indigo-100 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2 max-w-2xl mx-auto">
          {repos.slice(0, 6).map((r) => {
            // GitHub avatar URL is derived from the owner segment of the
            // full name. TrendingSection only hits api.github.com today, so
            // every owner has a matching avatar — but if this section ever
            // grows to include gitlab/codeberg trending, the URL prefix
            // here is the place to branch on source. The img onError below
            // gracefully degrades to a glyph placeholder so a single 404
            // from a deleted-account ghost owner doesn't show a broken icon.
            const owner = r.fullName.split("/")[0];
            const avatar = `https://avatars.githubusercontent.com/${owner}?s=40`;
            const initial = (r.name.charAt(0) || "?").toUpperCase();
            return (
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
                className="group flex items-center gap-2.5 rounded-xl bg-white/60 hover:bg-white border border-transparent hover:border-indigo-200 px-2.5 py-2 transition-colors"
                title={r.description ?? r.fullName}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Hide the broken img and show its sibling fallback.
                    const img = e.currentTarget;
                    img.style.display = "none";
                    const next = img.nextElementSibling as HTMLElement | null;
                    if (next) next.style.display = "inline-flex";
                  }}
                  className="w-5 h-5 rounded-full flex-shrink-0 border border-indigo-100 bg-white"
                />
                <span
                  aria-hidden
                  style={{ display: "none" }}
                  className="w-5 h-5 rounded-full flex-shrink-0 bg-indigo-100 text-indigo-700 text-[10px] font-semibold inline-flex items-center justify-center"
                >
                  {initial}
                </span>
                <div className="min-w-0 flex-1 flex items-baseline gap-1.5">
                  <span className="text-[13px] font-medium text-slate-800 group-hover:text-indigo-700 truncate flex-shrink-0 max-w-[55%]">
                    {r.name}
                  </span>
                  {r.description && (
                    <span className="text-[11.5px] text-slate-500 truncate">
                      {r.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 tabular-nums flex-shrink-0">
                  <Star className="w-3 h-3 text-amber-500" aria-hidden />
                  {r.stars.toLocaleString()}
                </div>
                <ArrowUpRight
                  className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors flex-shrink-0"
                  aria-hidden
                />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
