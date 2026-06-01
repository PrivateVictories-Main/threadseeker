// AI cross-source synthesis (optional). Takes the query + the top merged
// results and returns a short, opinionated verdict on the landscape — the
// crown of the layered search: the deterministic engine finds + ranks, the LLM
// summarizes "what should I actually pick?". Runs async after results render,
// so it never adds search latency. Edge-cached 1h. Degrades to nothing without
// the key.
import { corsPreflight, jsonResponse, sanitizeQuery, cachedJson } from "../_shared/http";
import { groqChat, type GroqEnv } from "../_shared/groq";

interface InProject {
  name?: string;
  source?: string;
  description?: string | null;
  stars?: number;
}

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction<GroqEnv> = async ({ request, env }) => {
  if (!env.GROQ_API_KEY) return jsonResponse({ disabled: true }, 200);

  let body: { query?: unknown; projects?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON" }, 400);
  }
  const query = sanitizeQuery(body?.query);
  const projects: InProject[] = Array.isArray(body?.projects)
    ? (body!.projects as InProject[]).slice(0, 10)
    : [];
  if (!query || projects.length === 0) return jsonResponse({ disabled: true }, 200);

  const lines = projects
    .map(
      (p, i) =>
        `${i + 1}. [${p.source ?? "?"}] ${p.name ?? "?"}${
          p.stars ? ` (${p.stars}★)` : ""
        } — ${(p.description ?? "").slice(0, 120)}`,
    )
    .join("\n");

  // Cache key includes the top project names so a different result set yields a
  // fresh verdict, but identical sets reuse it.
  const cacheKey = [
    "synth",
    query,
    ...projects.slice(0, 8).map((p) => String(p.name ?? "")),
  ];

  return cachedJson(request, cacheKey, 3600, async () => {
    const verdict = await groqChat(env, {
      model: "llama-3.3-70b-versatile",
      system:
        "You are a senior engineer giving a 2-3 sentence verdict on a cross-source open-source search. Be concrete and opinionated: name the canonical pick(s), say when to choose an alternative, and flag if the results look thin or off-target. No markdown, no headers, no lists, no preamble — just the verdict prose.",
      user: `Query: "${query}"\n\nTop results across sources:\n${lines}`,
      maxTokens: 220,
      temperature: 0.4,
    });
    if (!verdict) return { disabled: true };
    return { verdict: verdict.trim() };
  });
};
