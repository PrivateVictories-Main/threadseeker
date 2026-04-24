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

// Very light query sanitization — strip control chars, clamp length.
export function sanitizeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (cleaned.length < 1 || cleaned.length > 1000) return null;
  return cleaned;
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
  // Build a deterministic cache key URL — Cache API requires a GET.
  const keyUrl = `${url.origin}${url.pathname}?k=${encodeURIComponent(cacheKeyParts.join("|"))}`;
  const cacheKey = new Request(keyUrl, { method: "GET" });
  // @ts-expect-error — caches.default is available in the Workers runtime.
  const cache: Cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const body = await compute();
  const resp = jsonResponse(body, 200, {
    "Cache-Control": `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`,
  });
  // Clone before caching — the original is returned to the caller.
  await cache.put(cacheKey, resp.clone());
  return resp;
}
