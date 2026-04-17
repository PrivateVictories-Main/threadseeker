// Homebrew search. There's no public search endpoint, so we fetch the full
// formula + cask list (~4-5 MB combined) once and filter server-side. The
// full lists are cached at the edge for 24h — subsequent queries hit the
// warm cache and never re-fetch from brew.sh.
import { cachedJson, corsPreflight, jsonResponse, sanitizeQuery } from "../_shared/groq";

interface BrewPackage {
  kind: "formula" | "cask";
  name: string;
  full_token: string;
  desc: string | null;
  homepage: string;
  tap: string;
  updated: string;
  languages: string[];
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

  // Cache key is the lowercased query; the underlying index is also cached
  // per day via cf fetch cacheTtl below.
  return cachedJson(request, [query.toLowerCase(), "homebrew-v1"], 60 * 30, async () => {
    const [formulas, casks] = await Promise.all([
      fetchJsonIndex("https://formulae.brew.sh/api/formula.json"),
      fetchJsonIndex("https://formulae.brew.sh/api/cask.json"),
    ]);

    const q = query.toLowerCase();
    const scored: Array<{ score: number; pkg: BrewPackage }> = [];

    for (const f of formulas) {
      const hit = scoreMatch(q, f.name ?? "", f.desc ?? "");
      if (hit > 0) {
        scored.push({
          score: hit,
          pkg: {
            kind: "formula",
            name: f.name,
            full_token: f.full_name ?? f.name,
            desc: f.desc ?? null,
            homepage: f.homepage ?? `https://formulae.brew.sh/formula/${f.name}`,
            tap: f.tap ?? "homebrew/core",
            updated: f.versions?.stable ?? "",
            languages: [],
          },
        });
      }
    }
    for (const c of casks) {
      const hit = scoreMatch(q, c.token ?? c.name?.[0] ?? "", c.desc ?? "");
      if (hit > 0) {
        scored.push({
          score: hit,
          pkg: {
            kind: "cask",
            name: Array.isArray(c.name) ? c.name[0] : c.token,
            full_token: c.token,
            desc: c.desc ?? null,
            homepage: c.homepage ?? `https://formulae.brew.sh/cask/${c.token}`,
            tap: c.tap ?? "homebrew/cask",
            updated: c.version ?? "",
            languages: [],
          },
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 30).map(({ pkg }) => pkg);
    return { results: top };
  });
};

async function fetchJsonIndex(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 86400, cacheEverything: true },
      headers: { Accept: "application/json" },
    } as RequestInit);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function scoreMatch(query: string, name: string, desc: string): number {
  const n = name.toLowerCase();
  const d = desc.toLowerCase();
  if (!n) return 0;
  if (n === query) return 10_000;
  if (n.startsWith(query)) return 5_000;
  let s = 0;
  if (n.includes(query)) s += 1_500;
  for (const w of query.split(/\s+/)) {
    if (!w) continue;
    if (n.includes(w)) s += 300;
    if (d.includes(w)) s += 120;
  }
  return s;
}
