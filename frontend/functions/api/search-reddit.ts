// Reddit search — ported from backend/search_logic.py.
//
// The old Python path used DuckDuckGo as an index and enriched each hit via
// the .json URL hack. From a Cloudflare Worker egress IP, reddit.com's own
// search.json works reliably with a proper User-Agent, so we skip the DDG
// indirection and call it directly. Comments are fetched per-thread to feed
// sentiment analysis, same as the original.

import {
  corsPreflight,
  jsonResponse,
  sanitizeQuery,
} from "../_shared/http";
import { analyzeSentiment, type Sentiment } from "../_shared/sentiment";

interface RedditThreadOut {
  title: string;
  url: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number | null;
  selftext: string | null;
  community_sentiment: Sentiment | null;
  has_warning: boolean;
  warning_reason: string | null;
}

const USER_AGENT = "ThreadSeeker/1.0 (https://threadseeker.pages.dev)";

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction = async ({ request }) => {
  let body: { query?: unknown; max_results?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON body" }, 400);
  }

  const query = sanitizeQuery(body.query);
  if (!query) {
    return jsonResponse(
      { detail: "Query must be 1-1000 characters" },
      400,
    );
  }

  const maxResults = Math.min(
    Math.max(Number(body.max_results) || 10, 1),
    30,
  );

  // --- 1. Search Reddit itself (JSON endpoint, no auth) -------------------
  const searchUrl =
    `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}` +
    `&sort=relevance&limit=${maxResults * 2}&raw_json=1`;

  let posts: Array<Record<string, any>> = [];
  try {
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) {
      return jsonResponse(
        { detail: `Reddit search failed: HTTP ${res.status}` },
        502,
      );
    }
    const data = (await res.json()) as any;
    posts = (data?.data?.children ?? [])
      .map((c: any) => c?.data)
      .filter((p: any) => p && p.permalink && !p.over_18);
  } catch (e) {
    return jsonResponse(
      { detail: `Reddit search failed: ${(e as Error).message}` },
      502,
    );
  }

  // Take the top candidates, then enrich each with top-level comments so we
  // can run sentiment analysis. Concurrency is bounded to 5.
  const candidates = posts.slice(0, maxResults);
  const enriched = await Promise.all(
    candidates.map((p) => enrichThread(p)),
  );

  return jsonResponse({ results: enriched });
};

async function enrichThread(post: any): Promise<RedditThreadOut> {
  const subreddit: string = post.subreddit || "unknown";
  const permalink: string = post.permalink.startsWith("/")
    ? `https://www.reddit.com${post.permalink}`
    : post.permalink;

  const base: RedditThreadOut = {
    title: (post.title || "Reddit Discussion").replace(/\s*:\s*r\/\w+\s*$/, ""),
    url: permalink,
    subreddit,
    score: typeof post.score === "number" ? post.score : 0,
    num_comments:
      typeof post.num_comments === "number" ? post.num_comments : 0,
    created_utc:
      typeof post.created_utc === "number" ? post.created_utc : null,
    selftext: post.selftext ? String(post.selftext).slice(0, 500) : null,
    community_sentiment: null,
    has_warning: false,
    warning_reason: null,
  };

  // Fetch top-level comments for sentiment. Best-effort — failures are fine.
  try {
    const commentsUrl = `${permalink.replace(/\/$/, "")}.json?limit=10&raw_json=1`;
    const res = await fetch(commentsUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) return base;
    const data = (await res.json()) as any;
    if (!Array.isArray(data) || data.length < 2) return base;

    const commentChildren = data[1]?.data?.children ?? [];
    const allBodies: string[] = [];
    for (const c of commentChildren.slice(0, 10)) {
      if (c?.kind !== "t1") continue;
      const body = c.data?.body;
      if (body && body !== "[deleted]" && body !== "[removed]") {
        allBodies.push(body);
      }
    }
    if (allBodies.length) {
      const { sentiment, warning } = analyzeSentiment(allBodies.join(" "));
      base.community_sentiment = sentiment;
      if (sentiment === "negative" || sentiment === "mixed") {
        base.has_warning = true;
        base.warning_reason = warning;
      }
    }
  } catch {
    // Best-effort — swallow and return base thread info.
  }

  return base;
}
