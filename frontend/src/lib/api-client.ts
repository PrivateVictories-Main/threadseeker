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
    return threads.map((t, idx) => {
      // No created_utc -> leave timestamp blank (the no-signal convention every
      // other adapter follows). Stamping new Date() here granted threads with a
      // missing timestamp a spurious +500 freshness boost in the ranker.
      const created = t.created_utc
        ? new Date(t.created_utc * 1000).toISOString()
        : "";
      return {
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
        updatedAt: created,
        sentiment: t.community_sentiment,
        warning: t.has_warning ? t.warning_reason : undefined,
        upvotes: t.score || 0,
        comments: t.num_comments || 0,
        createdAt: created,
      };
    });
  } catch (error) {
    console.error("searchReddit failed:", error);
    return [];
  }
}

// ── Optional AI layer ──────────────────────────────────────────────────────
// Both helpers return null on any failure / when the layer is disabled (no
// GROQ_API_KEY) / when the Pages Functions aren't running (plain `next dev`),
// so callers transparently fall back to the deterministic engine.

export interface OptimizedQuery {
  keyTerms: string[];
  intent: string;
}

/** AI query understanding — natural language → concise key terms + intent. */
export async function optimizeQuery(
  query: string,
): Promise<OptimizedQuery | null> {
  try {
    const res = await fetch(apiUrl("/optimize-queries"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.disabled || !Array.isArray(data?.keyTerms) || data.keyTerms.length === 0) {
      return null;
    }
    return { keyTerms: data.keyTerms as string[], intent: data.intent ?? "general" };
  } catch {
    return null;
  }
}

/** AI cross-source verdict on the top results. Returns the prose or null. */
export async function synthesizeResults(
  query: string,
  projects: Array<{
    name: string;
    source: string;
    description: string | null;
    stars: number;
  }>,
): Promise<string | null> {
  try {
    const res = await fetch(apiUrl("/synthesize"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, projects }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.disabled || !data?.verdict ? null : String(data.verdict);
  } catch {
    return null;
  }
}
