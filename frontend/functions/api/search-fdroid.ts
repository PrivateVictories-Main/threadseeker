// F-Droid search. F-Droid doesn't expose a search endpoint either, so we
// fetch their index-v2 file once (cached 24h at the edge) and filter it.
// We keep the response slim — only id, name, summary, author, etc.
import { cachedJson, corsPreflight, jsonResponse, sanitizeQuery } from "../_shared/http";

interface FDroidApp {
  id: string;
  name: string | null;
  summary: string | null;
  description: string | null;
  icon: string | null;
  categories: string[];
  author: string | null;
  updated: string | null;
  sourceCode: string | null;
  license: string | null;
}

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction = async ({ request }) => {
  let body: { query?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON body" }, 400);
  }
  const query = sanitizeQuery(body.query);
  if (!query) return jsonResponse({ detail: "Query required" }, 400);

  return cachedJson(request, [query.toLowerCase(), "fdroid-v2"], 60 * 30, async () => {
    const apps = await fetchIndex();
    const q = query.toLowerCase();
    const scored: Array<{ score: number; app: FDroidApp }> = [];
    for (const app of apps) {
      const name = (app.name || app.id || "").toLowerCase();
      const summary = (app.summary || "").toLowerCase();
      if (!name) continue;
      let score = 0;
      if (name === q) score = 10_000;
      else if (name.startsWith(q)) score = 5_000;
      else if (name.includes(q)) score = 2_000;
      for (const w of q.split(/\s+/)) {
        if (!w) continue;
        if (name.includes(w)) score += 300;
        if (summary.includes(w)) score += 120;
      }
      if (score > 0) scored.push({ score, app });
    }
    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, 30).map((s) => s.app) };
  });
};

// Cache the parsed index across requests on a single Worker isolate.
let indexCache: { apps: FDroidApp[]; at: number } | null = null;

async function fetchIndex(): Promise<FDroidApp[]> {
  // Reuse if fresh in this isolate (≤ 1 hour).
  if (indexCache && Date.now() - indexCache.at < 60 * 60 * 1000) {
    return indexCache.apps;
  }
  try {
    // index-v1 is smaller than v2 and has everything we need.
    const res = await fetch("https://f-droid.org/repo/index-v1.json", {
      cf: { cacheTtl: 86400, cacheEverything: true },
      headers: { Accept: "application/json" },
    } as RequestInit);
    if (!res.ok) return [];
    const data = (await res.json()) as { apps?: any[] };
    const apps: FDroidApp[] = (data.apps || []).map((a: any) => ({
      id: a.packageName,
      name: typeof a.name === "string" ? a.name : a.localized?.["en-US"]?.name || a.packageName,
      summary:
        typeof a.summary === "string"
          ? a.summary
          : a.localized?.["en-US"]?.summary || null,
      description:
        typeof a.description === "string"
          ? a.description
          : a.localized?.["en-US"]?.description || null,
      icon: a.icon ? `https://f-droid.org/repo/icons-640/${a.icon}` : null,
      categories: a.categories || [],
      author: a.authorName || null,
      updated: a.lastUpdated ? new Date(a.lastUpdated).toISOString() : null,
      sourceCode: a.sourceCode || null,
      license: a.license || null,
    }));
    indexCache = { apps, at: Date.now() };
    return apps;
  } catch {
    return [];
  }
}
