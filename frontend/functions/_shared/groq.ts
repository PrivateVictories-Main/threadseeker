// Minimal Groq chat client for Pages Functions. Groq's OpenAI-compatible
// endpoint is fast (typically sub-second) and has a free tier, which is why the
// AI layer can be additive without hurting the app's "fast" feel.
//
// The ENTIRE AI layer is optional: when GROQ_API_KEY isn't set on the Pages
// project, groqChat returns null, the endpoints report { disabled: true }, and
// the frontend falls back to the deterministic engine. So the app stays free to
// run with zero secrets — the key only unlocks the enhancement.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqEnv {
  GROQ_API_KEY?: string;
}

export async function groqChat(
  env: GroqEnv,
  opts: {
    model: string;
    system: string;
    user: string;
    maxTokens?: number;
    temperature?: number;
    json?: boolean;
  },
): Promise<string | null> {
  if (!env.GROQ_API_KEY) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        max_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.3,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}
