// Minimal Groq client for Cloudflare Pages Functions.
// Uses the OpenAI-compatible /chat/completions endpoint. The Groq key is
// Ryan's Pages secret — there is no BYOK path; users never see/need a key.

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqCallOptions {
  apiKey: string;
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export async function callGroq(opts: GroqCallOptions): Promise<string> {
  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 300,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// Resolve the Pages secret. Returns null if unset — callers degrade gracefully.
export function resolveGroqKey(
  _request: Request,
  env: { GROQ_API_KEY?: string },
): string | null {
  return env.GROQ_API_KEY ?? null;
}

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
// without the Groq round-trip.
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
