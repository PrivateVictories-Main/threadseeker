// Homebrew search. There's no public search endpoint, so we fetch the full
// formula + cask list (~46 MB combined) once and filter server-side. The
// full lists are cached at the edge for 24h — subsequent queries hit the
// warm cache and never re-fetch from brew.sh.
import { cachedJson, corsPreflight, jsonResponse, sanitizeQuery, Uncacheable } from "../_shared/http";

interface BrewPackage {
  kind: "formula" | "cask";
  name: string;
  full_token: string;
  desc: string | null;
  homepage: string;
  tap: string;
  // Latest stable version. Formulae expose `versions.stable` (e.g. "3.7.0"),
  // casks expose top-level `version`. Used by the frontend adapter to set
  // `project.version` for the card-header version chip.
  version: string;
  // Legacy field kept for adapter back-compat. Currently unused as a
  // timestamp — homebrew doesn't expose updated-at on the index files.
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
    const [formulasRaw, casksRaw] = await Promise.all([
      fetchJsonIndex("https://formulae.brew.sh/api/formula.json"),
      fetchJsonIndex("https://formulae.brew.sh/api/cask.json"),
    ]);
    // Both halves down = transient failure: serve empty, never cache it.
    if (formulasRaw === null && casksRaw === null) {
      return new Uncacheable({ results: [] });
    }
    const formulas = formulasRaw ?? [];
    const casks = casksRaw ?? [];

    const q = query.toLowerCase();
    const scored: Array<{ score: number; pkg: BrewPackage }> = [];

    for (const f of formulas) {
      const hit = scoreMatch(q, f.name ?? "", f.desc ?? "");
      if (hit > 0) {
        const stable = f.versions?.stable ?? "";
        scored.push({
          score: hit,
          pkg: {
            kind: "formula",
            name: f.name,
            full_token: f.full_name ?? f.name,
            desc: f.desc ?? null,
            homepage: f.homepage ?? `https://formulae.brew.sh/formula/${f.name}`,
            tap: f.tap ?? "homebrew/core",
            version: stable,
            updated: stable, // legacy field — kept for back-compat
            languages: [],
          },
        });
      }
    }
    for (const c of casks) {
      const hit = scoreMatch(q, c.token ?? c.name?.[0] ?? "", c.desc ?? "");
      if (hit > 0) {
        const ver = c.version ?? "";
        scored.push({
          score: hit,
          pkg: {
            kind: "cask",
            name: Array.isArray(c.name) ? c.name[0] : c.token,
            full_token: c.token,
            desc: c.desc ?? null,
            homepage: c.homepage ?? `https://formulae.brew.sh/cask/${c.token}`,
            tap: c.tap ?? "homebrew/cask",
            version: ver,
            updated: ver, // legacy field — kept for back-compat
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

// null = transient upstream failure (vs. a legit empty index) — the caller
// turns that into an UNCACHED empty response instead of pinning it for 30min.
async function fetchJsonIndex(url: string): Promise<any[] | null> {
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 86400, cacheEverything: true },
      headers: { Accept: "application/json" },
    } as RequestInit);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return null;
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
