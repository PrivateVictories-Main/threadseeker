// Cross-source synthesis. Bucket the unified project list by source,
// build a prompt, ask Groq for a short verdict. Returns null synthesis
// silently when no API key is configured — the frontend hides the box.

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
  description: string | null;
  url: string;
  stars: number;
}

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction<{
  GROQ_API_KEY?: string;
}> = async ({ request, env }) => {
  let body: { query?: unknown; projects?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON body" }, 400);
  }
  const query = sanitizeQuery(body.query);
  if (!query) {
    return jsonResponse(
      { detail: "Query must be 1-1000 characters" },
      400,
    );
  }
  const projects: ProjectLite[] = Array.isArray(body.projects)
    ? (body.projects as ProjectLite[]).slice(0, 20)
    : [];
  if (projects.length === 0) {
    return jsonResponse({ synthesis: null });
  }

  const apiKey = resolveGroqKey(request, env);
  if (!apiKey) {
    return jsonResponse({ synthesis: null });
  }

  // Cache by query + first 8 project names. Shared queries produce identical
  // synth output for an hour — saves the slower 70b call.
  const topNames = projects
    .slice(0, 8)
    .map((p) => `${p.source}:${p.name}`)
    .join(",");
  const cacheParts = [query.toLowerCase(), topNames];
  const prompt = buildSynthesisPrompt(query, projects);

  return cachedJson(request, cacheParts, 60 * 60, async () => {
    try {
      const synthesis = await callGroq({
        apiKey,
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        maxTokens: 300,
        messages: [
          {
            role: "system",
            content:
              "You are a real-time technical research advisor. Synthesize findings to provide actionable insights. Emphasize how recent the information is.",
          },
          { role: "user", content: prompt },
        ],
      });
      return { synthesis: synthesis || null };
    } catch (e) {
      console.warn("Groq synthesis failed:", (e as Error).message);
      return { synthesis: null };
    }
  });
};

function buildSynthesisPrompt(query: string, projects: ProjectLite[]): string {
  const repos = projects
    .filter((p) => ["github", "gitlab", "codeberg"].includes(p.source))
    .slice(0, 5);
  const models = projects
    .filter((p) => ["huggingface", "paperswithcode"].includes(p.source))
    .slice(0, 5);
  const packages = projects
    .filter((p) =>
      ["npm", "pypi", "crates", "packagist", "rubygems", "jsr"].includes(
        p.source,
      ),
    )
    .slice(0, 5);
  const containers = projects
    .filter((p) => ["dockerhub", "flathub"].includes(p.source))
    .slice(0, 3);
  const community = projects
    .filter((p) =>
      ["reddit", "hackernews", "lobsters", "stackoverflow", "devto"].includes(
        p.source,
      ),
    )
    .slice(0, 5);

  const fmt = (p: ProjectLite) =>
    `- ${p.name}${p.stars ? ` (${p.stars}★)` : ""}: ${p.description || "No description"}`;

  return `You are a technical research advisor helping a developer find existing solutions.

USER'S QUERY: "${query}"

REPOSITORIES (GitHub / GitLab / Codeberg):
${repos.length ? repos.map(fmt).join("\n") : "None"}

MODELS & PAPERS (Hugging Face / Papers with Code):
${models.length ? models.map(fmt).join("\n") : "None"}

PACKAGE REGISTRIES (npm / PyPI / crates / Packagist / RubyGems / JSR):
${packages.length ? packages.map(fmt).join("\n") : "None"}

CONTAINERS & DESKTOP APPS (Docker Hub / Flathub):
${containers.length ? containers.map(fmt).join("\n") : "None"}

COMMUNITY DISCUSSIONS (Reddit / HN / Lobsters / SO / Dev.to):
${community.length ? community.map(fmt).join("\n") : "None"}

Based on these findings, provide a concise verdict (3-4 sentences max):
1. Is there a strong existing solution?
2. What's the recommended starting point from the top results?
3. Any important community warnings or trends?

Be direct and actionable. Start with the bottom line.`;
}
