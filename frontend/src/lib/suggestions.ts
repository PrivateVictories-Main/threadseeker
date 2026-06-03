// Search autocomplete — curated, human-readable OSS queries spanning every
// category, blended with the user's own recent history. Purely client-side +
// instant (no network), so the dropdown feels Google-fast. The deterministic
// engine handles all of these well, so suggesting them steers users toward
// queries that return great results.

export interface Suggestion {
  text: string;
  kind: "recent" | "suggestion";
}

// Hand-picked, natural-phrasing queries (not the kebab synonym keys). Ordered
// roughly by breadth/popularity so the unfiltered top reads well.
export const CURATED_QUERIES: string[] = [
  "react state management",
  "vector database",
  "local llm runtime",
  "rust http framework",
  "python web framework",
  "css framework",
  "javascript bundler",
  "typescript orm",
  "http client library",
  "end-to-end testing framework",
  "authentication library",
  "component library",
  "static site generator",
  "container orchestration",
  "message queue",
  "self-hosted photo library",
  "markdown editor",
  "terminal emulator",
  "code editor",
  "game engine",
  "3d rendering engine",
  "image generation model",
  "speech to text model",
  "text embeddings model",
  "retrieval augmented generation",
  "mcp server",
  "agentic ai framework",
  "llm observability",
  "data visualization library",
  "web scraping library",
  "pdf parsing library",
  "date library",
  "form validation library",
  "graphql client",
  "websocket library",
  "kubernetes operator",
  "feature flags",
  "background job queue",
  "object storage client",
  "kafka alternative",
  "redis alternative",
  "postgres extension",
  "sqlite alternative",
  "headless cms",
  "api gateway",
  "reverse proxy",
  "password manager",
  "note taking app",
  "diagramming tool",
  "monorepo tooling",
];

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Suggestions for the current input: recent history first (matches), then
 * curated queries (prefix matches before substring matches). De-duped
 * case-insensitively, the exact current input excluded, capped at `limit`.
 * An empty input returns the user's recent history + a few curated starters.
 */
export function getSuggestions(
  input: string,
  history: string[] = [],
  limit = 7,
): Suggestion[] {
  const q = norm(input);
  const seen = new Set<string>();
  const out: Suggestion[] = [];

  const push = (text: string, kind: Suggestion["kind"]) => {
    const key = norm(text);
    if (!key || key === q || seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push({ text, kind });
  };

  // Empty input → recent history, then a few curated starters.
  if (!q) {
    for (const h of history) push(h, "recent");
    for (const c of CURATED_QUERIES) push(c, "suggestion");
    return out;
  }

  // Recent history matches (most-recent-first).
  for (const h of history) {
    if (norm(h).includes(q)) push(h, "recent");
  }
  // Curated: prefix matches first, then substring matches.
  const matches = CURATED_QUERIES.filter((c) => norm(c).includes(q));
  matches.sort((a, b) => {
    const ap = norm(a).startsWith(q) ? 0 : 1;
    const bp = norm(b).startsWith(q) ? 0 : 1;
    return ap - bp;
  });
  for (const c of matches) push(c, "suggestion");

  return out;
}
