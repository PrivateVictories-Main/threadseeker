// Generic GET proxy for sources whose browser CORS is either missing or
// flaky. The frontend calls /api/proxy?url=<encoded-api-url> and we forward
// the request with edge caching. The host must be on the allowlist — this
// is not a general-purpose open proxy.
//
// Every entry here is a public, read-only JSON endpoint.
import { corsPreflight, jsonResponse, crossOriginBlocked } from "../_shared/http";

const HOST_ALLOWLIST = new Set<string>([
  "hub.docker.com",
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
  "pub.dev",
]);

// POST passthrough is deliberately a SEPARATE, tighter allowlist. Flathub
// retired its GET search (405) in favor of POST /api/v2/search with a JSON
// body, and the GET relay can't express that. Only hosts that *require* POST
// search earn an entry here — everything else stays on the read-only GET path
// so the relay never becomes a general-purpose POST trampoline.
const POST_HOST_ALLOWLIST = new Set<string>(["flathub.org"]);

// Cap relayed POST bodies. A search query is tiny; anything bigger is abuse.
const MAX_POST_BODY_BYTES = 4_096;

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestGet: PagesFunction = async ({ request }) => {
  // Block cross-origin browser abuse of the relay (same-origin GET passes;
  // a foreign site's fetch is rejected). Origin-less callers stay allowed.
  const blocked = crossOriginBlocked(request);
  if (blocked) return blocked;
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
      // Do NOT follow redirects: the allowlist only validates the first hop, so
      // a 3xx Location to an off-allowlist host would turn an allowlisted open
      // redirect into an SSRF pivot. Refuse any redirect outright.
      redirect: "manual",
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
  // status 0 == opaqueredirect (spec runtimes); 3xx == raw redirect (workerd).
  if (upstream.status === 0 || (upstream.status >= 300 && upstream.status < 400)) {
    return jsonResponse({ detail: "Upstream redirect refused" }, 502);
  }

  const body = await upstream.text();
  const upstreamType = upstream.headers.get("content-type") ?? "application/json";
  // Never reflect attacker-influenced HTML under our own origin. Force a JSON
  // type for JSON bodies and a non-renderable text/plain + attachment for
  // anything else, so /api/proxy can't be navigated to as an HTML page.
  const isJson = /^application\/(json|[\w.+-]+\+json)\b/i.test(upstreamType);
  const resp = new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": isJson ? "application/json" : "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      ...(isJson ? {} : { "Content-Disposition": "attachment" }),
    },
  });

  if (upstream.ok) {
    await cache.put(cacheKey, resp.clone());
  }
  return resp;
};

// POST passthrough — same SSRF posture as GET (https-only, host allowlist,
// refuse redirects, force safe content-types) plus a JSON-only, size-capped
// body relay. No edge caching: the Cache API only keys GETs, and the single
// consumer (Flathub search) is fast enough to skip the complexity of a
// body-hash cache key.
export const onRequestPost: PagesFunction = async ({ request }) => {
  const blocked = crossOriginBlocked(request);
  if (blocked) return blocked;
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
  if (!POST_HOST_ALLOWLIST.has(parsed.hostname)) {
    return jsonResponse(
      { detail: `Host not allowlisted for POST: ${parsed.hostname}` },
      400,
    );
  }

  // Only relay small, valid JSON bodies — re-serialize rather than streaming
  // the raw bytes so the upstream can never receive smuggled non-JSON content.
  const raw = await request.text();
  if (raw.length > MAX_POST_BODY_BYTES) {
    return jsonResponse({ detail: "Body too large" }, 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return jsonResponse({ detail: "Body must be JSON" }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      method: "POST",
      // Same redirect refusal as GET: the allowlist only validates hop one.
      redirect: "manual",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "ThreadSeeker/1.0 (https://threadseeker.pages.dev)",
      },
      body: JSON.stringify(body),
    } as RequestInit);
  } catch (e) {
    return jsonResponse({ detail: `Upstream fetch failed: ${(e as Error).message}` }, 502);
  }
  if (upstream.status === 0 || (upstream.status >= 300 && upstream.status < 400)) {
    return jsonResponse({ detail: "Upstream redirect refused" }, 502);
  }

  const text = await upstream.text();
  const upstreamType = upstream.headers.get("content-type") ?? "application/json";
  const isJson = /^application\/(json|[\w.+-]+\+json)\b/i.test(upstreamType);
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type": isJson ? "application/json" : "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
      ...(isJson ? {} : { "Content-Disposition": "attachment" }),
    },
  });
};
