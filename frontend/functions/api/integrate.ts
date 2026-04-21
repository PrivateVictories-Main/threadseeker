// Generate a minimal integration snippet for a specific project given the
// user's original query. Hits Groq with a tight prompt, returns a short
// block of runnable code + a one-line recap. Cached by (project.id, query)
// so the same card/query pair is instant.

import {
  cachedJson,
  callGroq,
  corsPreflight,
  jsonResponse,
  resolveGroqKey,
  sanitizeQuery,
} from "../_shared/groq";

interface ProjectLite {
  source: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  url: string;
  topics?: string[];
}

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction<{
  GROQ_API_KEY?: string;
}> = async ({ request, env }) => {
  let body: { query?: unknown; project?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON body" }, 400);
  }

  const query = sanitizeQuery(body.query);
  if (!query) {
    return jsonResponse({ detail: "Query must be 1-1000 characters" }, 400);
  }

  const raw = body.project as Partial<ProjectLite> | undefined;
  if (!raw || typeof raw !== "object") {
    return jsonResponse({ detail: "Missing project" }, 400);
  }
  // Defense-in-depth: cap all string fields before they reach the model.
  const project: ProjectLite = {
    source: String(raw.source || "").slice(0, 32),
    name: String(raw.name || "").slice(0, 200),
    fullName: String(raw.fullName || raw.name || "").slice(0, 300),
    description: raw.description ? String(raw.description).slice(0, 500) : null,
    language: raw.language ? String(raw.language).slice(0, 50) : null,
    url: String(raw.url || "").slice(0, 500),
    topics: Array.isArray(raw.topics)
      ? raw.topics.slice(0, 10).map((t: unknown) => String(t).slice(0, 40))
      : [],
  };
  if (!project.source || !project.name) {
    return jsonResponse({ detail: "Project missing source/name" }, 400);
  }

  const apiKey = resolveGroqKey(request, env);
  if (!apiKey) {
    return jsonResponse({ snippet: null });
  }

  const cacheParts = [
    query.toLowerCase(),
    project.source,
    project.fullName.toLowerCase(),
  ];

  return cachedJson(request, cacheParts, 24 * 60 * 60, async () => {
    try {
      const snippet = await callGroq({
        apiKey,
        // Use the fast model; integration snippets are short, single-shot.
        model: "llama-3.1-8b-instant",
        temperature: 0.2,
        maxTokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You generate minimal, runnable integration snippets for open-source projects. Output ONLY: a 1-line summary, then a fenced code block, then a 1-line caveat. No preamble, no conclusions.",
          },
          { role: "user", content: buildPrompt(query, project) },
        ],
      });
      return { snippet: snippet || null };
    } catch (e) {
      console.warn("Groq integrate failed:", (e as Error).message);
      return { snippet: null };
    }
  });
};

function buildPrompt(query: string, p: ProjectLite): string {
  const topics = p.topics?.length ? ` [${p.topics.slice(0, 6).join(", ")}]` : "";
  return `Generate a minimal integration snippet for this project that addresses the user's goal.

USER GOAL: "${query}"

PROJECT:
- Source: ${p.source}
- Name: ${p.fullName}${topics}
- Language: ${p.language || "unknown"}
- Description: ${p.description || "(none)"}
- URL: ${p.url}

Output format (EXACT, nothing else):
One sentence saying what this snippet does.

\`\`\`<language>
// minimal working example, 5-15 lines
\`\`\`

One-line caveat about API keys, versions, or setup if relevant — otherwise omit.`;
}
