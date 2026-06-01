// Authenticated GitHub API proxy.
//
// The browser calls /api/gh?url=<encoded api.github.com URL> and we forward it
// with a server-side token (the GITHUB_TOKEN Pages secret, never exposed to the
// client) plus a short edge cache. This is the difference between the flagship
// source being usable and being throttled: unauthenticated GitHub is 10 req/min
// (search) / 60 req/hr (core) shared across ALL visitors on Cloudflare's egress
// IP; authenticated it's 30 req/min (search) / 5000 req/hr (core), and the edge
// cache means repeat queries cost nothing.
//
// Works WITHOUT the token too (just unauthenticated) so the app stays free to
// run. Allowlisted to api.github.com only — not a general proxy (SSRF guard).
//
// Optional ?accept= lets callers request a non-JSON media type (e.g. the raw
// README endpoint uses application/vnd.github.v3.raw).
import { corsPreflight, jsonResponse } from "../_shared/http";

interface Env {
  GITHUB_TOKEN?: string;
}

const ALLOWED_HOST = "api.github.com";
const CACHE_TTL = 300; // 5 min — fresh enough to feel live, cheap enough to dedupe

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  const accept =
    url.searchParams.get("accept") || "application/vnd.github.v3+json";
  if (!target) return jsonResponse({ detail: "Missing ?url" }, 400);

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return jsonResponse({ detail: "Invalid url" }, 400);
  }
  if (parsed.protocol !== "https:" || parsed.host !== ALLOWED_HOST) {
    return jsonResponse({ detail: `Only https://${ALLOWED_HOST} allowed` }, 400);
  }

  // Cache keyed by the full request (url + accept).
  const cacheKey = new Request(request.url, { method: "GET" });
  // @ts-expect-error caches.default is available in the Workers runtime
  const cache: Cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "ThreadSeeker/1.0 (https://threadseeker.pages.dev)",
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), { headers });
  } catch (e) {
    return jsonResponse(
      { detail: `GitHub fetch failed: ${(e as Error).message}` },
      502,
    );
  }

  const body = await upstream.text();
  const resp = new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`,
    },
  });
  // Only cache successful responses so a transient rate-limit/5xx doesn't stick.
  if (upstream.ok) await cache.put(cacheKey, resp.clone());
  return resp;
};
