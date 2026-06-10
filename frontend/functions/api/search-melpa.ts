// MELPA (Emacs packages) search. melpa.org has no search API — its own UI
// downloads the full archive and filters client-side — so we fetch the
// archive (~2.7 MB, ~6200 packages) plus the separate download-counts file
// (~160 KB), join them by name, cache both 24h at the edge, and filter
// server-side. Mirrors search-homebrew / search-fdroid.
import { cachedJson, corsPreflight, jsonResponse, sanitizeQuery, Uncacheable } from "../_shared/http";

// Slim per-package shape we ship to the frontend adapter.
interface MelpaPackage {
  name: string;
  // MELPA versions are date-encoded snapshots: ver [20260609, 956] →
  // "20260609.956". Ugly but honest — it's the only version MELPA has.
  version: string;
  desc: string | null;
  // Cumulative install count from download_counts.json — MELPA's one real
  // popularity signal, joined by package name. 0 when the counts file lacks
  // the package (or failed to fetch).
  downloads: number;
  // props.url — the package's upstream repo (GitHub/sourcehut/...). The
  // card links to the MELPA page; this is surfaced as `homepage`.
  repo: string | null;
  // props.keywords — Emacs finder keywords ("convenience", "tools", ...).
  keywords: string[];
  // ISO date derived from ver[0] (YYYYMMDD = the snapshot build date, i.e.
  // the last upstream commit MELPA packaged) — a real freshness signal.
  updated: string;
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
  return cachedJson(request, [query.toLowerCase(), "melpa-v1"], 60 * 30, async () => {
    const packages = await fetchIndex();
    // Archive down = transient failure: serve empty, never cache it. (A
    // failed counts fetch is tolerable — results just lack downloads — so
    // only the archive gates cacheability, matching homebrew's
    // one-half-down tolerance.)
    if (packages === null) return new Uncacheable({ results: [] });

    const q = query.toLowerCase();
    const scored: Array<{ score: number; pkg: MelpaPackage }> = [];
    for (const pkg of packages) {
      const hit = scoreMatch(q, pkg.name, pkg.desc ?? "");
      if (hit > 0) scored.push({ score: hit, pkg });
    }
    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, 30).map((s) => s.pkg) };
  });
};

// Cache the parsed + joined index across requests on a single Worker isolate.
let indexCache: { packages: MelpaPackage[]; at: number } | null = null;

// ver[0] is the snapshot build date as a YYYYMMDD number (e.g. 20260609).
// Parse it strictly — anything that isn't 8 digits maps to "" (no fake
// freshness), and the Date is validated before toISOString() can throw.
function verDateToIso(raw: unknown): string {
  const s = String(raw ?? "");
  const m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return "";
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

// null = transient upstream failure of the ARCHIVE (vs. a legit empty index)
// — the caller serves empty WITHOUT edge-caching it. The counts file failing
// alone degrades to downloads:0 rather than nuking the source.
async function fetchIndex(): Promise<MelpaPackage[] | null> {
  // Reuse if fresh in this isolate (≤ 1 hour).
  if (indexCache && Date.now() - indexCache.at < 60 * 60 * 1000) {
    return indexCache.packages;
  }
  const [archive, counts] = await Promise.all([
    fetchJson("https://melpa.org/archive.json"),
    fetchJson("https://melpa.org/download_counts.json"),
  ]);
  if (archive === null || typeof archive !== "object" || Array.isArray(archive)) {
    return null;
  }
  const countMap =
    counts !== null && typeof counts === "object" && !Array.isArray(counts)
      ? (counts as Record<string, unknown>)
      : {};
  const packages: MelpaPackage[] = Object.entries(
    archive as Record<string, any>,
  ).map(([name, p]) => {
    const ver = Array.isArray(p?.ver) ? p.ver : [];
    const dl = countMap[name];
    return {
      name,
      version: ver.length ? ver.join(".") : "",
      desc: typeof p?.desc === "string" && p.desc ? p.desc : null,
      downloads: typeof dl === "number" && dl > 0 ? dl : 0,
      repo: typeof p?.props?.url === "string" && p.props.url ? p.props.url : null,
      keywords: Array.isArray(p?.props?.keywords)
        ? p.props.keywords.filter((k: unknown) => typeof k === "string").slice(0, 6)
        : [],
      updated: verDateToIso(ver[0]),
    };
  });
  indexCache = { packages, at: Date.now() };
  return packages;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: 86400, cacheEverything: true },
      headers: { Accept: "application/json" },
    } as RequestInit);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Same relevance scorer as search-homebrew: exact name ≫ name prefix ≫ name
// substring ≫ per-word name/desc hits.
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
