// Backend API client for ThreadSeeker.
//
// The backend is now a handful of Cloudflare Pages Functions that ship with
// the frontend at `/api/*`. In production the routes are same-origin; in
// local dev we override via NEXT_PUBLIC_BACKEND_URL to point at
// `wrangler pages dev` (typically http://localhost:8788).
//
// Endpoints (all POST, JSON):
//   /api/search-reddit     — Reddit CORS-blocked search with sentiment
//   /api/optimize-queries  — AI-optimized per-platform queries
//   /api/synthesize        — Cross-source AI verdict
//
// Everything else (GitHub, npm, PyPI, HF, HN, GitLab, Codeberg, crates.io,
// Packagist, RubyGems) is called directly from the browser.
import type { UnifiedProject } from "./sources";

const BACKEND_OVERRIDE =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";

// Resolve the base for API calls. Empty string means same-origin `/api/...`.
const API_BASE = BACKEND_OVERRIDE || "";

function apiUrl(path: string): string {
  return `${API_BASE}/api${path}`;
}

export interface OptimizedQueries {
  github_query: string;
  huggingface_query: string;
  reddit_query: string;
  intent?: string;
  source_weights?: Record<string, number>;
  reasoning?: string;
}

export async function optimizeQueries(
  query: string,
): Promise<OptimizedQueries | null> {
  try {
    const response = await fetch(apiUrl("/optimize-queries"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) return null;
    return (await response.json()) as OptimizedQueries;
  } catch (error) {
    console.error("optimizeQueries failed:", error);
    return null;
  }
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

export async function synthesizeResults(
  query: string,
  projects: UnifiedProject[],
): Promise<string | null> {
  if (projects.length === 0) return null;
  try {
    const response = await fetch(apiUrl("/synthesize"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        projects: projects.slice(0, 20).map((p) => ({
          source: p.source,
          name: p.fullName,
          description: p.description,
          url: p.url,
          stars: p.stars,
        })),
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.synthesis || null;
  } catch (error) {
    console.error("synthesize failed:", error);
    return null;
  }
}

// API is always "configured" now — the functions ship with the site.
// Callers use this to decide whether to attempt backend-gated features.
// For local `next dev` without `wrangler pages dev`, set
// NEXT_PUBLIC_BACKEND_URL=disabled to suppress calls that would 404.
export function isBackendConfigured(): boolean {
  return BACKEND_OVERRIDE !== "disabled";
}
