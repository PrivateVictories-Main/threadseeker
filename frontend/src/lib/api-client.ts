// Backend API client for ThreadSeeker
// Calls the Python FastAPI backend for things the browser can't do directly:
//   - Reddit search (CORS blocked)
//   - AI query optimization (Groq key must stay server-side)
//   - AI synthesis across multi-source results
//   - Content extraction (Trafilatura is Python-only)

import type { UnifiedProject } from "./sources";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";

function backendAvailable(): boolean {
  return BACKEND_URL.length > 0;
}

export interface OptimizedQueries {
  github_query: string;
  huggingface_query: string;
  reddit_query: string;
  intent?: string;
  source_weights?: Record<string, number>;
  reasoning?: string;
}

export interface RefinementQuestion {
  id: string;
  question: string;
  options: Array<{
    value: string;
    label: string;
    icon: string;
    description: string;
  }>;
}

export interface QueryAnalysis {
  needs_refinement: boolean;
  original_query: string;
  questions: RefinementQuestion[];
  message?: string;
}

export async function analyzeQuery(query: string): Promise<QueryAnalysis | null> {
  if (!backendAvailable()) return null;
  try {
    const response = await fetch(`${BACKEND_URL}/analyze-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) return null;
    return (await response.json()) as QueryAnalysis;
  } catch (error) {
    console.error("Backend analyzeQuery failed:", error);
    return null;
  }
}

export async function optimizeQueries(
  query: string
): Promise<OptimizedQueries | null> {
  if (!backendAvailable()) return null;
  try {
    const response = await fetch(`${BACKEND_URL}/optimize-queries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) return null;
    return (await response.json()) as OptimizedQueries;
  } catch (error) {
    console.error("Backend optimizeQueries failed:", error);
    return null;
  }
}

export async function searchRedditViaBackend(
  query: string
): Promise<UnifiedProject[]> {
  if (!backendAvailable()) {
    // Frontend falls back to empty results when backend is unavailable
    return [];
  }
  try {
    const response = await fetch(`${BACKEND_URL}/search-reddit`, {
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
    console.error("Backend searchReddit failed:", error);
    return [];
  }
}

export async function synthesizeResults(
  query: string,
  projects: UnifiedProject[]
): Promise<string | null> {
  if (!backendAvailable() || projects.length === 0) return null;
  try {
    const response = await fetch(`${BACKEND_URL}/synthesize`, {
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
    console.error("Backend synthesize failed:", error);
    return null;
  }
}

export function isBackendConfigured(): boolean {
  return backendAvailable();
}
