// AI query understanding (optional). Turns a developer's natural-language query
// — especially a long paragraph — into a concise keyword query for upstream
// code/package search, plus an intent label. The frontend calls this only for
// long queries and races it against a short timeout, falling back to the
// deterministic coreSearchQuery when the key is unset, the call is slow, or the
// response is unusable. Edge-cached 24h.
import { corsPreflight, jsonResponse, sanitizeQuery, cachedJson } from "../_shared/http";
import { groqChat, type GroqEnv } from "../_shared/groq";

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction<GroqEnv> = async ({ request, env }) => {
  if (!env.GROQ_API_KEY) return jsonResponse({ disabled: true }, 200);

  let body: { query?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON" }, 400);
  }
  const query = sanitizeQuery(body?.query);
  if (!query) return jsonResponse({ disabled: true }, 200);

  return cachedJson(request, ["optimize", query], 24 * 3600, async () => {
    const raw = await groqChat(env, {
      model: "llama-3.1-8b-instant",
      system:
        'You convert a developer\'s natural-language search into a concise keyword query for code and package search engines. Reply with ONLY a JSON object: {"keyTerms": string[] of 3-6 lowercase technical terms (most distinctive first, no filler words), "intent": one of ["project_search","how_to","recommendation","comparison","troubleshooting","model_search","general"]}. No prose.',
      user: query,
      json: true,
      maxTokens: 200,
      temperature: 0.2,
    });
    if (!raw) return { disabled: true };
    try {
      const parsed = JSON.parse(raw) as { keyTerms?: unknown; intent?: unknown };
      const keyTerms = Array.isArray(parsed.keyTerms)
        ? parsed.keyTerms.filter((t): t is string => typeof t === "string").slice(0, 6)
        : [];
      if (keyTerms.length === 0) return { disabled: true };
      return {
        keyTerms,
        intent: typeof parsed.intent === "string" ? parsed.intent : "general",
      };
    } catch {
      return { disabled: true };
    }
  });
};
