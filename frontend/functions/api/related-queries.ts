// Related-query suggestions. Takes the user's query and returns 4 short
// related queries to show as chips below the result count. Pure Groq; the
// rule-based fallback below just mechanically varies the query so the chip
// row never sits empty when the key is missing.

import {
  cachedJson,
  callGroq,
  corsPreflight,
  jsonResponse,
  resolveGroqKey,
  sanitizeQuery,
} from "../_shared/groq";

interface RelatedResponse {
  related: string[];
}

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction<{
  GROQ_API_KEY?: string;
}> = async ({ request, env }) => {
  let body: { query?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON body" }, 400);
  }
  const query = sanitizeQuery(body.query);
  if (!query) {
    return jsonResponse({ detail: "Query must be 1-1000 characters" }, 400);
  }

  const apiKey = resolveGroqKey(request, env);
  const cacheParts = [query.toLowerCase(), apiKey ? "ai" : "rule", "v1"];

  // 1-day cache — related queries don't drift fast.
  return cachedJson(request, cacheParts, 60 * 60 * 24, async () => {
    if (apiKey) {
      try {
        const content = await callGroq({
          apiKey,
          model: "llama-3.1-8b-instant",
          temperature: 0.6,
          maxTokens: 200,
          messages: [
            {
              role: "system",
              content:
                "Always respond with a JSON array of strings and nothing else.",
            },
            {
              role: "user",
              content: `A developer searched: "${query}".
Suggest 4 short related search queries they might try next — sibling tools,
alternative implementations, or deeper topics. Each ≤ 6 words, no punctuation.
Do NOT repeat the original query. Reply with a JSON array of 4 strings only.`,
            },
          ],
        });
        const parsed = extractArray(content);
        if (parsed && parsed.length > 0) {
          return { related: parsed.slice(0, 4) } satisfies RelatedResponse;
        }
      } catch (e) {
        console.warn("Groq related-queries failed:", (e as Error).message);
      }
    }

    // Rule-based fallback — simple lexical variations.
    return { related: fallbackVariations(query) } satisfies RelatedResponse;
  });
};

function extractArray(text: string): string[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return null;
    return arr
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0 && x.length <= 80);
  } catch {
    return null;
  }
}

function fallbackVariations(query: string): string[] {
  const q = query.trim();
  return [
    `${q} alternative`,
    `best ${q}`,
    `${q} tutorial`,
    `${q} vs`,
  ];
}
