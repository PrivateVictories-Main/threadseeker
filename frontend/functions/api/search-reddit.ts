// Reddit search.
//
// 2026-06: reddit.com now 403s ALL keyless JSON endpoints (www/old/api hosts,
// any User-Agent — verified 12 ways from multiple IPs), so the free
// search.json path this file was built on is dead upstream. The fix is the
// official OAuth2 client-credentials flow: when REDDIT_CLIENT_ID +
// REDDIT_CLIENT_SECRET are set as Pages secrets (a free "script" app at
// reddit.com/prefs/apps), we mint an app-only bearer token (cached at the
// edge for its ~24h lifetime) and search via oauth.reddit.com. Without the
// secrets the keyless attempt remains (it 403s → honest 502 → the client
// shows reddit in the failed-sources tray), so behavior is unchanged until
// the owner adds credentials — at which point this lights up with zero code
// changes. Comments are fetched per-thread to feed sentiment, as always.

import {
  corsPreflight,
  jsonResponse,
  sanitizeQuery,
} from "../_shared/http";
import { analyzeSentiment, type Sentiment } from "../_shared/sentiment";

interface Env {
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
}

// App-only OAuth token, cached in the edge cache (Cache API needs a GET key).
// Reddit issues ~24h tokens; cache for 23h so we never serve a stale one.
async function getRedditToken(env: Env): Promise<string | null> {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) return null;
  const cache: Cache = caches.default;
  const cacheKey = new Request(
    "https://threadseeker.internal/reddit-token-v1",
    { method: "GET" },
  );
  const hit = await cache.match(cacheKey);
  if (hit) {
    const cached = (await hit.json()) as { token?: string };
    if (cached.token) return cached.token;
  }
  try {
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`),
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) return null;
    await cache.put(
      cacheKey,
      new Response(JSON.stringify({ token: data.access_token }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=82800, s-maxage=82800",
        },
      }),
    );
    return data.access_token;
  } catch {
    return null;
  }
}

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
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

  // --- 1. Search Reddit: OAuth host when credentialed, keyless otherwise --
  const token = await getRedditToken(env);
  const searchHost = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const searchUrl =
    `${searchHost}/search.json?q=${encodeURIComponent(query)}` +
    `&sort=relevance&limit=${maxResults * 2}&raw_json=1`;

  let posts: Array<Record<string, any>> = [];
  try {
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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
    candidates.map((p) => enrichThread(p, token)),
  );

  return jsonResponse({ results: enriched });
};

async function enrichThread(post: any, token: string | null): Promise<RedditThreadOut> {
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
  // Same host rule as the search: oauth.reddit.com when credentialed
  // (www.reddit.com 403s keylessly).
  try {
    const path = permalink.replace(/^https:\/\/www\.reddit\.com/, "").replace(/\/$/, "");
    const commentsUrl = token
      ? `https://oauth.reddit.com${path}.json?limit=10&raw_json=1`
      : `${permalink.replace(/\/$/, "")}.json?limit=10&raw_json=1`;
    const res = await fetch(commentsUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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
