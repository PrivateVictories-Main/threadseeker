// vcpkg (C/C++ ports) search. vcpkg.io has no search endpoint — the site
// itself is a static SPA that downloads the full port index — so we do the
// same: fetch output.json (~2.6 MB, ~2800 ports) once, cache it 24h at the
// edge, and filter server-side. Mirrors search-homebrew / search-fdroid.
import { cachedJson, corsPreflight, jsonResponse, sanitizeQuery, Uncacheable } from "../_shared/http";

// Slim per-port shape we ship to the frontend adapter. The raw index entry
// carries Dependencies/Features/Supports etc. that the card never renders —
// dropping them keeps the 30-result response small.
interface VcpkgPort {
  name: string;
  version: string;
  desc: string | null;
  // NB: the live index (curl-verified 2026-06-10) uses a LOWERCASE
  // `homepage` key (2631/2833 ports); the capitalized `Homepage` of older
  // docs never appears. We read both defensively.
  homepage: string | null;
  // SPDX expression, present on ~70% of ports.
  license: string | null;
  // ISO timestamp derived from the index's `LastModified` ("YYYY-MM-DD",
  // present on every port) — a real last-touched signal, unlike Homebrew
  // which exposes none. vcpkg exposes NO stars/downloads; we ship none.
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
  return cachedJson(request, [query.toLowerCase(), "vcpkg-v1"], 60 * 30, async () => {
    const ports = await fetchIndex();
    // Transient failure — serve empty but do NOT pin it into the edge cache.
    if (ports === null) return new Uncacheable({ results: [] });

    const q = query.toLowerCase();
    const scored: Array<{ score: number; port: VcpkgPort }> = [];
    for (const port of ports) {
      const hit = scoreMatch(q, port.name, port.desc ?? "");
      if (hit > 0) scored.push({ score: hit, port });
    }
    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, 30).map((s) => s.port) };
  });
};

// Cache the parsed index across requests on a single Worker isolate.
let indexCache: { ports: VcpkgPort[]; at: number } | null = null;

// `Description` ships as a plain string on most ports but as an ARRAY of
// paragraph strings on ~50 (abseil, etc.) — both shapes are live as of
// 2026-06-10. Normalize to one string so the adapter never sees the split.
function normalizeDesc(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    const joined = raw.filter((x) => typeof x === "string").join(" ").trim();
    return joined || null;
  }
  return null;
}

// `LastModified` is a bare "YYYY-MM-DD" — valid ISO-8601 date, but guard the
// conversion anyway: an Invalid Date's toISOString() throws, and one bad row
// must not zero the whole index.
function safeIso(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

// null = transient upstream failure (vs. a legit empty index) — the caller
// serves empty WITHOUT edge-caching it.
async function fetchIndex(): Promise<VcpkgPort[] | null> {
  // Reuse if fresh in this isolate (≤ 1 hour).
  if (indexCache && Date.now() - indexCache.at < 60 * 60 * 1000) {
    return indexCache.ports;
  }
  try {
    const res = await fetch("https://vcpkg.io/output.json", {
      cf: { cacheTtl: 86400, cacheEverything: true },
      headers: { Accept: "application/json" },
    } as RequestInit);
    if (!res.ok) return null;
    const data = (await res.json()) as { Source?: any[] };
    const ports: VcpkgPort[] = (data.Source || [])
      .filter((p: any) => typeof p?.Name === "string" && p.Name)
      .map((p: any) => ({
        name: p.Name,
        version: typeof p.Version === "string" ? p.Version : "",
        desc: normalizeDesc(p.Description),
        homepage:
          (typeof p.homepage === "string" && p.homepage) ||
          (typeof p.Homepage === "string" && p.Homepage) ||
          null,
        license: typeof p.License === "string" && p.License ? p.License : null,
        updated: safeIso(p.LastModified),
      }));
    indexCache = { ports, at: Date.now() };
    return ports;
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
