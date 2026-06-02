// Generic GET proxy for sources whose browser CORS is either missing or
// flaky. The frontend calls /api/proxy?url=<encoded-api-url> and we forward
// the request with edge caching. The host must be on the allowlist — this
// is not a general-purpose open proxy.
//
// Every entry here is a public, read-only JSON endpoint.
import { corsPreflight, jsonResponse } from "../_shared/http";

const HOST_ALLOWLIST = new Set<string>([
  "hub.docker.com",
  "paperswithcode.com",
  "jsr.io",
  "api.jsr.io",
  "flathub.org",
  "dev.to",
  "lobste.rs",
  "api.stackexchange.com",
  "formulae.brew.sh",
  "f-droid.org",
  "sourceforge.net",
  "arxiv.org",
  "export.arxiv.org",
  "aur.archlinux.org",
  "api.anaconda.org",
  "api.wordpress.org",
  "hex.pm",
]);

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) return jsonResponse({ detail: "Missing ?url" }, 400);

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return jsonResponse({ detail: "Invalid url" }, 400);
  }
  if (parsed.protocol !== "https:") {
    return jsonResponse({ detail: "Only https allowed" }, 400);
  }
  if (!HOST_ALLOWLIST.has(parsed.hostname)) {
    return jsonResponse({ detail: `Host not allowlisted: ${parsed.hostname}` }, 400);
  }

  const cacheKey = new Request(request.url, { method: "GET" });
  const cache: Cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "ThreadSeeker/1.0 (https://threadseeker.pages.dev)",
      },
      // Cloudflare-specific cache hint
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
  } catch (e) {
    return jsonResponse({ detail: `Upstream fetch failed: ${(e as Error).message}` }, 502);
  }

  const body = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const resp = new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });

  if (upstream.ok) {
    await cache.put(cacheKey, resp.clone());
  }
  return resp;
};
