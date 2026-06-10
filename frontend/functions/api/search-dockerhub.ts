// Docker Hub search relay.
//
// 2026-06: hub.docker.com rate-limits Cloudflare's shared egress IPs — the
// generic /api/proxy lane 429s for every visitor, every time (live-verified
// 5/5). Docker Hub honors authenticated requests, so this dedicated relay
// mints a JWT via /v2/users/login when DOCKERHUB_USERNAME +
// DOCKERHUB_TOKEN (a free account + access token) are set as Pages secrets,
// caches the JWT at the edge (~30-day validity upstream; cached 24h), and
// searches with the Bearer header. WITHOUT the secrets it makes the same
// unauthenticated call the proxy did — identical behavior (429 → honest
// empty) until the owner adds credentials, then this lights up with zero
// code changes.

import {
  corsPreflight,
  jsonResponse,
  sanitizeQuery,
  cachedJson,
  Uncacheable,
} from "../_shared/http";

interface Env {
  DOCKERHUB_USERNAME?: string;
  DOCKERHUB_TOKEN?: string;
}

const USER_AGENT = "ThreadSeeker/1.0 (https://threadseeker.pages.dev)";

async function getDockerJwt(env: Env): Promise<string | null> {
  if (!env.DOCKERHUB_USERNAME || !env.DOCKERHUB_TOKEN) return null;
  const cache: Cache = caches.default;
  const cacheKey = new Request(
    "https://threadseeker.internal/dockerhub-jwt-v1",
    { method: "GET" },
  );
  const hit = await cache.match(cacheKey);
  if (hit) {
    const cached = (await hit.json()) as { token?: string };
    if (cached.token) return cached.token;
  }
  try {
    const res = await fetch("https://hub.docker.com/v2/users/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        username: env.DOCKERHUB_USERNAME,
        password: env.DOCKERHUB_TOKEN,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    if (!data.token) return null;
    await cache.put(
      cacheKey,
      new Response(JSON.stringify({ token: data.token }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      }),
    );
    return data.token;
  } catch {
    return null;
  }
}

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { query?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON body" }, 400);
  }
  const query = sanitizeQuery(body.query);
  if (!query) return jsonResponse({ detail: "Query required" }, 400);

  return cachedJson(request, [query.toLowerCase(), "dockerhub-v1"], 60 * 30, async () => {
    const jwt = await getDockerJwt(env);
    try {
      const res = await fetch(
        `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(query)}&page_size=30`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": USER_AGENT,
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          signal: AbortSignal.timeout(10_000),
          cf: { cacheTtl: 300, cacheEverything: true },
        } as RequestInit,
      );
      // Transient upstream failure (the keyless 429 included) — serve empty
      // but never pin it into the edge cache.
      if (!res.ok) return new Uncacheable({ results: [] });
      const data = (await res.json()) as { results?: unknown[] };
      return { results: Array.isArray(data.results) ? data.results : [] };
    } catch {
      return new Uncacheable({ results: [] });
    }
  });
};
