// Backend API client for ThreadSeeker.
//
// The backend is now a handful of Cloudflare Pages Functions that ship with
// the frontend at `/api/*`. In production the routes are same-origin; in
// local dev we override via NEXT_PUBLIC_BACKEND_URL to point at
// `wrangler pages dev` (typically http://localhost:8788).
//
// Endpoints (all POST, JSON):
//   /api/search-reddit     — Reddit CORS-blocked search with sentiment
//
// Everything else (GitHub, npm, PyPI, HF, HN, GitLab, Codeberg, crates.io,
// Packagist, RubyGems, arXiv, F-Droid, Homebrew) is called directly from
// the browser or via same-origin Pages Functions that don't need a client
// helper.
import type { UnifiedProject } from "./sources";

const BACKEND_OVERRIDE =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";

// Resolve the base for API calls. Empty string means same-origin `/api/...`.
const API_BASE = BACKEND_OVERRIDE || "";

function apiUrl(path: string): string {
  return `${API_BASE}/api${path}`;
}

export async function searchRedditViaBackend(
  query: string,
): Promise<UnifiedProject[]> {
  try {
    const response = await fetch(apiUrl("/search-reddit"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const threads = (data.results || []) as Array<Record<string, any>>;
    return threads.map((t, idx) => ({
      id: `reddit-${idx}-${encodeURIComponent(t.url || "")}`,
      source: "reddit" as const,
      name: t.title || "Reddit Thread",
      fullName: `r/${t.subreddit || "unknown"}`,
      description: t.selftext || null,
      url: t.url,
      stars: t.score || 0,
      commentsCount: t.num_comments || 0,
      language: null,
      topics: [],
      author: { name: `r/${t.subreddit || "unknown"}`, avatar: "" },
      updatedAt: t.created_utc
        ? new Date(t.created_utc * 1000).toISOString()
        : new Date().toISOString(),
      sentiment: t.community_sentiment,
      warning: t.has_warning ? t.warning_reason : undefined,
    }));
  } catch (error) {
    console.error("searchReddit failed:", error);
    return [];
  }
}
