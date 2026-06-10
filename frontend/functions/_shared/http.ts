// Shared HTTP helpers for Cloudflare Pages Functions.
// Generic response, CORS, query sanitization, and edge-cache utilities.

// Shared JSON response helper with permissive CORS for local dev.
export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Pages _headers don't apply to Function responses, so nosniff must be
      // set here. Callers' extraHeaders still override via the spread below.
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...extraHeaders,
    },
  });
}

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "3600",
    },
  });
}

// Light cross-origin guard for the quota-sensitive AI endpoints. A same-origin
// browser fetch() sends Origin === the deployment origin on POST, so a DIFFERENT
// Origin is cross-site browser abuse → reject. Origin-less callers (curl,
// server-side) and localhost dev are allowed. This only blunts the easy browser
// vector; the real control is a Cloudflare dashboard rate-limit rule on
// /api/optimize-queries + /api/synthesize (see SECURITY.md).
export function crossOriginBlocked(request: Request): Response | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  let expected: string;
  try {
    expected = new URL(request.url).origin;
  } catch {
    return null;
  }
  if (origin === expected) return null;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return null;
  } catch {
    /* malformed Origin → fall through to block */
  }
  return jsonResponse({ detail: "Forbidden — cross-origin requests are not allowed." }, 403);
}

// Very light query sanitization — strip control chars, clamp length.
export function sanitizeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (cleaned.length < 1 || cleaned.length > 1000) return null;
  return cleaned;
}

// Wrapper a compute() can return to say "serve this body but do NOT edge-cache
// it". Lets the search functions distinguish a legit empty answer (cacheable —
// plenty of queries genuinely match nothing) from a TRANSIENT upstream failure,
// which must not pin an empty result set into the cache for the full TTL
// (6h for arXiv) long after upstream recovers.
export class Uncacheable {
  constructor(public body: unknown) {}
}

// Cache a POST handler's JSON response in Cloudflare's edge cache, keyed by
// the request URL + a deterministic body hash. Same (query) => instant reply
// without a round-trip to the upstream.
export async function cachedJson(
  request: Request,
  cacheKeyParts: string[],
  ttlSeconds: number,
  compute: () => Promise<unknown>,
): Promise<Response> {
  const url = new URL(request.url);
  // Build a deterministic cache key URL — Cache API requires a GET. Encode
  // EACH part before joining so values containing a literal "|" (project
  // names, queries) can't collide across different key tuples.
  const keyUrl = `${url.origin}${url.pathname}?k=${cacheKeyParts.map(encodeURIComponent).join("|")}`;
  const cacheKey = new Request(keyUrl, { method: "GET" });
  const cache: Cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const computed = await compute();
  const skipCache = computed instanceof Uncacheable;
  const body = skipCache ? (computed as Uncacheable).body : computed;
  const resp = jsonResponse(body, 200, {
    "Cache-Control": skipCache
      ? "no-store"
      : `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`,
  });
  // Never cache a degraded/disabled result — otherwise a single transient
  // upstream failure (e.g. a Groq 5xx/timeout returning { disabled: true })
  // would pin the failure into the edge cache for the full TTL and silently
  // kill the feature long after upstream recovers. Only cache real successes.
  const degraded =
    body != null &&
    typeof body === "object" &&
    (body as Record<string, unknown>).disabled === true;
  if (!skipCache && !degraded) await cache.put(cacheKey, resp.clone());
  return resp;
}
