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
import { corsPreflight, jsonResponse, crossOriginBlocked } from "../_shared/http";

interface Env {
  GITHUB_TOKEN?: string;
}

const ALLOWED_HOST = "api.github.com";
const CACHE_TTL = 300; // 5 min — fresh enough to feel live, cheap enough to dedupe

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Block cross-origin browser abuse of the token-authed relay (same-origin GET
  // sends no Origin and passes; a foreign site's fetch is rejected). Origin-less
  // callers stay allowed — the dashboard rate-limit rule is the backstop there.
  const blocked = crossOriginBlocked(request);
  if (blocked) return blocked;
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
    // redirect:"manual" is load-bearing for SECURITY here: with the default
    // redirect:follow, Cloudflare's fetch forwards the Authorization: Bearer
    // <GITHUB_TOKEN> header to cross-host 3xx targets (GitHub issues cross-host
    // 302s on archive/tarball/raw endpoints → codeload/objects.githubusercontent),
    // leaking the token. We only ever call search/repos/readme, which return
    // 200 inline, so refusing any redirect is safe and closes the exfil path.
    // Cap the upstream wait: GitHub's unauthenticated tier has been observed
    // hanging >30s under rate-limit pressure. A timeout rejects the fetch
    // promise (TimeoutError), landing in the catch below → same 502 shape.
    upstream = await fetch(parsed.toString(), {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return jsonResponse(
      { detail: `GitHub fetch failed: ${(e as Error).message}` },
      502,
    );
  }
  if (upstream.status === 0 || (upstream.status >= 300 && upstream.status < 400)) {
    return jsonResponse({ detail: "GitHub redirect refused" }, 502);
  }

  const body = await upstream.text();
  // Never reflect a renderable content-type under our origin: with a caller-
  // controlled ?accept=, GitHub's .html media types would otherwise let any
  // public repo's content render as a *.pages.dev page (inline scripts run —
  // the static-export CSP must allow 'unsafe-inline'). JSON passes through;
  // everything else (raw README markdown etc.) is text/plain, which is
  // exactly what the client consumes it as. Pages _headers don't apply to
  // Function responses, so nosniff is set here explicitly.
  const upstreamType = upstream.headers.get("content-type") ?? "application/json";
  const isJson = /^application\/(json|[\w.+-]+\+json)\b/i.test(upstreamType);
  const resp = new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": isJson ? "application/json" : "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
      // Errors must not be browser-cached for 5 min — only successes are fresh.
      "Cache-Control": upstream.ok
        ? `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`
        : "no-store",
    },
  });
  // Only cache successful responses so a transient rate-limit/5xx doesn't stick.
  if (upstream.ok) await cache.put(cacheKey, resp.clone());
  return resp;
};
