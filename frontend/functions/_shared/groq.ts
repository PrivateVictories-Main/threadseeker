// Minimal Groq client for Cloudflare Pages Functions.
// Uses the OpenAI-compatible /chat/completions endpoint.
// Supports an optional user-provided key (via X-Groq-API-Key header) that
// overrides the Pages secret — mirrors the old FastAPI behavior.

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

// Look up a Groq key: user-supplied header takes priority over Pages env.
export function resolveGroqKey(
  request: Request,
  env: { GROQ_API_KEY?: string },
): string | null {
  const userKey = request.headers.get("x-groq-api-key")?.trim();
  if (userKey && /^gsk_[a-zA-Z0-9]{20,}$/.test(userKey)) return userKey;
  if (env.GROQ_API_KEY) return env.GROQ_API_KEY;
  return null;
}

// Shared JSON response helper with permissive CORS for local dev.
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Groq-API-Key",
    },
  });
}

export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Groq-API-Key",
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
