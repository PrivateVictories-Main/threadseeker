// One function per upstream source. Every adapter returns the same
// SearchResult shape so the orchestrator and the UI can treat every
// platform interchangeably. Three flavors of transport:
//
//   1. Direct fetch()       — CORS-enabled public APIs
//   2. fetchViaProxy()      — proxied through /api/proxy for broken-CORS hosts
//   3. callBackend()        — proxied through a dedicated Pages Function when
//                             the upstream has no search API and we index it
//                             server-side (Homebrew, F-Droid, arXiv Atom XML)
//
// Error handling convention: an adapter NEVER throws. On any failure it
// returns { projects: [], totalCount: 0, source }. The orchestrator is free
// to race all adapters and still render partial results.

import { SearchResult } from "./types";
import { searchRedditViaBackend } from "../api-client";
import { ghFetch } from "../github";
import { expandQuery } from "./synonyms";
import { significantTokens } from "./resilience";

// --- Shared transport helpers ---

// For hosts whose CORS is missing or inconsistent. The Pages Function adds
// a host allowlist and edge caching on top.
async function fetchViaProxy(
  targetUrl: string,
  signal?: AbortSignal,
): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";
  const proxied = `${base}/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  return fetch(proxied, { signal });
}

// POST variant of the relay, for the rare upstream whose search is POST-only
// (currently just Flathub). The Pages Function keeps a separate, tighter
// host allowlist for POST — see functions/api/proxy.ts.
async function postViaProxy(
  targetUrl: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";
  const proxied = `${base}/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  return fetch(proxied, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

// For sources backed by a dedicated Pages Function (e.g. /api/search-arxiv).
async function callBackend<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T | null> {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";
  if (base === "disabled") return null;
  try {
    const res = await fetch(`${base}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Minimal HTML helpers for upstream fields that ship escaped or tagged.
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Defensive ISO conversion for upstream date strings. `new Date(x)` happily
// produces an Invalid Date whose .toISOString() THROWS — and when that happens
// inside a .map() it zeroes the entire source. Every adapter date transform
// must route through this (or an equivalent guard) instead of chaining
// new Date(...).toISOString() bare.
function safeIso(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const d = new Date(raw as string | number);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

// WordPress.org serves `last_updated` as a 12-hour-clock string with no
// zero-padding: "2026-04-01 4:54pm GMT" (verified by curl 2026-06-10). That
// shape is unparseable by `new Date()` even after naive " "→"T" / "GMT"→"Z"
// substitution — the old transform threw a RangeError per plugin and blanked
// the whole source. Parse the am/pm form explicitly; fall back to the native
// parser for any other shape; never throw.
function parseWordPressDate(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const m = raw
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})\s*(am|pm)?(?:\s*GMT)?$/i);
  if (m) {
    let hours = parseInt(m[2], 10);
    const meridiem = m[4]?.toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    return safeIso(`${m[1]}T${String(hours).padStart(2, "0")}:${m[3]}:00Z`);
  }
  return safeIso(raw);
}

// --- Repo hosts ---

export async function searchGitHub(
  query: string,
  page: number = 1,
  deepSearch: boolean = true,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenIds = new Set<number>();

  const searchStrategies = deepSearch
    ? [`${query} in:name,description,topics`, query]
    : [query];

  // Routed through /api/gh (server-side token + edge cache) in production, with
  // a transparent direct fallback in plain dev — see lib/github.ts.
  const responses = await Promise.all(
    searchStrategies.map(async (searchQuery) => {
      const params = new URLSearchParams({
        q: searchQuery,
        sort: "stars",
        order: "desc",
        page: page.toString(),
        per_page: "50",
      });
      try {
        const response = await ghFetch(
          `https://api.github.com/search/repositories?${params}`,
          undefined,
          signal,
        );
        if (!response || !response.ok) {
          if (response?.status === 403) console.warn("GitHub rate limit reached");
          return [];
        }
        const data = await response.json();
        return (data.items || []) as any[];
      } catch (error) {
        console.error(`GitHub search error for "${searchQuery}":`, error);
        return [];
      }
    }),
  );

  for (const items of responses) {
    for (const item of items) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        allResults.push(item);
      }
    }
  }

  return {
    projects: allResults.map((item: any) => ({
      id: `github-${item.id}`,
      source: "github" as const,
      name: item.name,
      fullName: item.full_name,
      description: item.description,
      url: item.html_url,
      stars: item.stargazers_count,
      language: item.language,
      topics: item.topics || [],
      author: {
        // Optional-chain: a deleted/suspended/abuse-flagged owner is null, and
        // an unguarded deref here throws out of .map() (outside the try/catch),
        // silently zeroing the entire flagship GitHub source for the whole run.
        name: item.owner?.login || item.full_name?.split("/")[0] || "unknown",
        avatar:
          item.owner?.avatar_url ||
          (item.owner?.login ? `https://github.com/${item.owner.login}.png?size=96` : ""),
      },
      updatedAt: item.updated_at,
      license: item.license?.name || item.license?.spdx_id,
      homepage: item.homepage || undefined,
      // Iter-15 enrichment: forks / open issues / watchers light up the
      // metric grid. created_at gates the "new" / "trending" / "established"
      // popularity-class badge derivation.
      forks: item.forks_count,
      openIssues: item.open_issues_count,
      watchers: item.watchers_count,
      createdAt: item.created_at,
      archived: item.archived === true,
      pushedAt: item.pushed_at,
    })),
    totalCount: allResults.length,
    source: "github",
  };
}

export async function searchGitLab(
  query: string,
  page: number = 1,
  _deepSearch: boolean = true,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenIds = new Set<number>();

  const params = new URLSearchParams({
    search: query,
    order_by: "star_count",
    sort: "desc",
    page: page.toString(),
    per_page: "50",
  });

  try {
    const response = await fetch(`https://gitlab.com/api/v4/projects?${params}`, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (response.ok) {
      const items = await response.json();
      items.forEach((item: any) => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allResults.push(item);
        }
      });
    }
  } catch (error) {
    console.error("GitLab search error:", error);
  }

  return {
    projects: allResults.map((item: any) => ({
      id: `gitlab-${item.id}`,
      source: "gitlab" as const,
      name: item.name,
      fullName: item.path_with_namespace,
      description: item.description,
      url: item.web_url,
      stars: item.star_count || 0,
      language: item.programming_language,
      topics: item.topics || item.tag_list || [],
      author: {
        name: item.namespace?.name || item.owner?.name || "Unknown",
        avatar: item.namespace?.avatar_url || item.owner?.avatar_url || "",
      },
      updatedAt: item.last_activity_at,
      forks: item.forks_count,
      openIssues: item.open_issues_count,
      createdAt: item.created_at,
    })),
    totalCount: allResults.length,
    source: "gitlab",
  };
}

export async function searchCodeberg(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://codeberg.org/api/v1/repos/search?q=${encodeURIComponent(query)}&limit=40&sort=stars&order=desc`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "codeberg" };
    const data = await response.json();
    const repos = data.data || [];
    return {
      projects: repos.map((r: any) => ({
        id: `codeberg-${r.id}`,
        source: "codeberg" as const,
        name: r.name,
        fullName: r.full_name,
        description: r.description || null,
        url: r.html_url,
        stars: r.stars_count || 0,
        language: r.language || null,
        topics: r.topics || [],
        author: {
          name: r.owner?.login || "unknown",
          avatar: r.owner?.avatar_url || "",
        },
        updatedAt: r.updated_at,
        forks: r.forks_count,
        openIssues: r.open_issues_count,
        createdAt: r.created_at,
      })),
      totalCount: repos.length,
      source: "codeberg",
    };
  } catch (error) {
    console.error("Codeberg search error:", error);
    return { projects: [], totalCount: 0, source: "codeberg" };
  }
}

// --- AI/ML registries ---

export async function searchHuggingFace(
  query: string,
  _page: number = 1,
  deepSearch: boolean = true,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const allItems: any[] = [];
  const seenIds = new Set<string>();

  const endpoints = [
    `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=50`,
  ];
  if (deepSearch) {
    endpoints.push(
      `https://huggingface.co/api/datasets?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=20`,
    );
  }

  const responses = await Promise.all(
    endpoints.map(async (url) => {
      try {
        const r = await fetch(url, { headers: { Accept: "application/json" }, signal });
        if (!r.ok) return [];
        // The for-of below runs OUTSIDE this try/catch — an unexpected
        // non-array body (error envelope, {}) must become [] here, or the
        // iteration throws and rejects the whole source.
        const parsed = await r.json();
        return Array.isArray(parsed) ? (parsed as any[]) : [];
      } catch (error) {
        console.error(`Hugging Face search error (${url}):`, error);
        return [];
      }
    }),
  );
  for (const items of responses) {
    for (const item of items) {
      // Require a string id at ingestion — the .map() below does
      // item.id.split("/") OUTSIDE the try/catch, so a missing/non-string id
      // would throw and zero the whole HuggingFace source (same class as the
      // GitHub owner-null bug).
      if (item && typeof item.id === "string" && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        allItems.push(item);
      }
    }
  }

  return {
    projects: allItems.map((item: any) => ({
      id: `hf-${item.id}`,
      source: "huggingface" as const,
      name: item.id.split("/").pop() || item.id,
      fullName: item.id,
      description: item.description || item.pipeline_tag || "AI Model",
      url: `https://huggingface.co/${item.id}`,
      stars: item.likes || 0,
      downloads: item.downloads || 0,
      language: item.library_name || "transformers",
      topics: item.tags || [],
      author: {
        name: item.author || item.id.split("/")[0],
        avatar: `https://cdn-avatars.huggingface.co/v1/production/uploads/${item.id.split("/")[0]}/avatar.jpg`,
      },
      updatedAt: item.lastModified || "",
      license: item.license,
      // Iter-15: explicit fields make the metric-grid renderer
      // unambiguous on HF — `stars` doubles as `upvotes` on thread
      // sources, but here it's literally a "likes" count, so surface it.
      upvotes: item.likes || 0,
      createdAt: item.createdAt,
    })),
    totalCount: allItems.length,
    source: "huggingface",
  };
}

// pub.dev (Dart / Flutter). Search returns package NAMES only, so we look up
// the top few by name for descriptions/versions (bounded fan-out, via proxy).
export async function searchPub(query: string, signal?: AbortSignal): Promise<SearchResult> {
  try {
    const res = await fetchViaProxy(
      `https://pub.dev/api/search?q=${encodeURIComponent(query)}`,
      signal,
    );
    if (!res.ok) return { projects: [], totalCount: 0, source: "pub" };
    const data = await res.json();
    const names: string[] = Array.isArray(data.packages)
      ? data.packages.slice(0, 8).map((p: any) => p?.package).filter(Boolean)
      : [];
    const details = await Promise.all(
      names.map(async (name) => {
        try {
          const r = await fetchViaProxy(
            `https://pub.dev/api/packages/${encodeURIComponent(name)}`,
            signal,
          );
          return r.ok ? await r.json() : null;
        } catch {
          return null;
        }
      }),
    );
    const projects = details
      .filter((d): d is any => !!d && typeof d.name === "string")
      .map((d: any) => {
        const latest = d.latest || {};
        const ps = latest.pubspec || {};
        return {
          id: `pub-${d.name}`,
          source: "pub" as const,
          name: d.name,
          fullName: d.name,
          description: ps.description || null,
          url: `https://pub.dev/packages/${d.name}`,
          stars: 0,
          language: "Dart",
          topics: Array.isArray(ps.topics) ? ps.topics.slice(0, 6) : [],
          author: { name: ps.publisher || "", avatar: "" },
          updatedAt: latest.published || "",
          version: latest.version,
          homepage: ps.homepage || ps.repository || undefined,
        };
      });
    return { projects, totalCount: projects.length, source: "pub" };
  } catch {
    return { projects: [], totalCount: 0, source: "pub" };
  }
}

export async function searchArxiv(query: string, signal?: AbortSignal): Promise<SearchResult> {
  const data = await callBackend<{ results: any[] }>("/search-arxiv", { query }, signal);
  if (!data) return { projects: [], totalCount: 0, source: "arxiv" };
  const results = data.results || [];
  return {
    projects: results.map((p: any) => {
      const published = p.published || p.updated || "";
      const year = (() => {
        const d = new Date(published);
        return Number.isNaN(d.getTime()) ? undefined : d.getUTCFullYear();
      })();
      const authors = Array.isArray(p.authors) ? (p.authors as string[]) : [];
      const pid = String(p.id || p.url || "");
      return {
        id: `arxiv-${pid || p.title || "item"}`,
        source: "arxiv" as const,
        name: p.title || "Untitled",
        fullName: pid.replace(/^https?:\/\/arxiv\.org\/abs\//, "arXiv:") || "arXiv",
        description: p.summary || null,
        url: p.url,
        stars: 0,
        language: null,
        topics: p.categories || [],
        author: {
          name: authors[0] || "unknown",
          avatar: "",
        },
        updatedAt: published,
        // Iter-15: paper-shape metrics for the metric grid.
        paperYear: year,
        paperAuthors: authors,
        createdAt: published,
      };
    }),
    totalCount: results.length,
    source: "arxiv",
  };
}

// Papers with Code was removed 2026-06: the service shut down and every
// API path now 302s to huggingface.co. arXiv + Zenodo carry the paper beat.

// --- Language package registries ---

export async function searchNpm(
  query: string,
  _deepSearch: boolean = true,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenNames = new Set<string>();

  try {
    const response = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=50`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (response.ok) {
      const data = await response.json();
      const items = data.objects || [];
      items.forEach((item: any) => {
        if (!seenNames.has(item.package.name)) {
          seenNames.add(item.package.name);
          allResults.push(item);
        }
      });
    }
  } catch (error) {
    console.error("npm search error:", error);
  }

  return {
    projects: allResults.map((item: any) => ({
      id: `npm-${item.package.name}`,
      source: "npm" as const,
      name: item.package.name,
      fullName: item.package.name,
      description: item.package.description,
      url: item.package.links.npm,
      // npm packages have no GitHub-style stars. The search API only exposes
      // a 0..1 quality/popularity/maintenance score. Surfacing quality*1000
      // as fake "stars" made a 0.9-quality package read as "900 stars" and
      // out-rank real high-star repos. Use 0 here and feed npm's genuine
      // popularity signal to the ranker via popularityScore (see ranking-bm25).
      stars: 0,
      downloads: item.package.downloads || 0,
      language: "JavaScript",
      topics: item.package.keywords || [],
      author: {
        name: item.package.publisher?.username || item.package.author?.name || "Unknown",
        avatar: item.package.publisher?.avatars?.small || "",
      },
      updatedAt: item.package.date,
      license: item.package.license,
      version: item.package.version,
      homepage: item.package.links?.homepage || item.package.links?.repository,
      // Iter-15 enrichment: npm's search response carries `downloads.weekly`
      // (sometimes nested as `item.downloads`); surface both as we encounter
      // them. Last-published mirrors `package.date` semantically — same
      // upstream timestamp, but the metric-grid renderer keys off the
      // explicit `lastPublished` field for the "LAST PUBLISH" cell.
      weeklyDownloads:
        typeof item.downloads === "object"
          ? item.downloads?.weekly
          : typeof item.downloads === "number"
            ? item.downloads
            : item.package.downloads?.weekly,
      lastPublished: item.package.date,
      // npm's own 0..1 popularity score (downloads + dependents), the honest
      // replacement for the old fake-stars popularity proxy.
      popularityScore: item.score?.detail?.popularity,
    })),
    totalCount: allResults.length,
    source: "npm",
  };
}

// PyPI has no usable free search API — the JSON API is per-package (exact
// name) and the search page is bot-walled. So we resolve a set of *candidate
// package names* and look each up by exact name:
//   - the raw query + its dash-joined form (catches "fastapi", "http-client")
//   - each significant token (catches single-word concepts)
//   - the curated synonym expansions, which ARE canonical package names
//     (e.g. "http client" → httpx/requests; "web scraping" → scrapy/beautifulsoup)
// That last source turns a concept query into real PyPI hits, which the old
// `python-X` name-guessing never could. Misses simply 404 and are dropped; the
// ranker (BM25F + recency) sorts the survivors by the full query.
export async function searchPyPI(
  query: string,
  deepSearch: boolean = true,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenNames = new Set<string>();

  const lc = query.toLowerCase().trim();
  const dash = lc.replace(/\s+/g, "-");
  const candidates = new Set<string>([lc, dash]);
  for (const t of significantTokens(query)) candidates.add(t);
  for (const s of expandQuery(query).synonymTerms) {
    candidates.add(s.replace(/\s+/g, "-"));
  }
  if (deepSearch) {
    candidates.add(`python-${dash}`);
    candidates.add(`${dash}-python`);
  }
  // Bound the fan-out of per-package JSON lookups.
  const terms = Array.from(candidates).filter(Boolean).slice(0, 12);

  const fetches = terms.map(async (term) => {
    try {
      const res = await fetch(
        `https://pypi.org/pypi/${encodeURIComponent(term)}/json`,
        { signal },
      );
      if (res.ok) return await res.json();
    } catch {}
    return null;
  });

  for (const data of await Promise.all(fetches)) {
    if (data && data.info && !seenNames.has(data.info.name)) {
      seenNames.add(data.info.name);
      allResults.push(data);
    }
  }

  return {
    projects: allResults.map((data) => {
      // Latest release timestamp — PyPI exposes per-release file lists at
      // `releases[version]` with each file carrying `upload_time_iso_8601`.
      // Pick the latest version's first file's timestamp; fall back to
      // urls[0].upload_time_iso_8601 (newer-style) before defaulting to
      // "now" so cards don't lie with a fake "just now" timestamp.
      const v = data.info?.version;
      let latest: string | undefined;
      const release = v && Array.isArray(data.releases?.[v]) ? data.releases[v][0] : null;
      if (release) {
        latest = release.upload_time_iso_8601 || release.upload_time;
      }
      if (!latest && Array.isArray(data.urls) && data.urls[0]) {
        latest = data.urls[0].upload_time_iso_8601 || data.urls[0].upload_time;
      }
      return {
        id: `pypi-${data.info.name}`,
        source: "pypi" as const,
        name: data.info.name,
        fullName: data.info.name,
        description: data.info.summary,
        url:
          data.info.project_url ||
          data.info.home_page ||
          `https://pypi.org/project/${data.info.name}`,
        stars: 0,
        downloads: 0,
        language: "Python",
        topics:
          data.info.keywords
            ?.split(",")
            .map((k: string) => k.trim())
            .filter(Boolean) || [],
        author: {
          name: data.info.author || "Unknown",
          avatar: "",
        },
        // Iter-15: when we have a real upload timestamp, use it for both
        // updatedAt (drives maintenance pill) and lastPublished (metric
        // grid). Fall back to "" (not Date.now) so the caption suppresses
        // cleanly instead of lying with "just now" — matches homebrew.
        updatedAt: latest || "",
        license: data.info.license,
        version: data.info.version,
        homepage: data.info.home_page || undefined,
        lastPublished: latest,
      };
    }),
    totalCount: allResults.length,
    source: "pypi",
  };
}

export async function searchCrates(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=50&sort=relevance`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "crates" };
    const data = await response.json();
    const crates = data.crates || [];
    return {
      projects: crates.map((c: any) => ({
        id: `crates-${c.id}`,
        source: "crates" as const,
        name: c.name,
        fullName: c.name,
        description: c.description,
        url: `https://crates.io/crates/${c.name}`,
        stars: 0,
        downloads: c.downloads || 0,
        language: "Rust",
        topics: c.keywords || c.categories || [],
        author: { name: "crates.io", avatar: "" },
        updatedAt: c.updated_at || "",
        license: c.license,
        version: c.max_stable_version || c.newest_version,
        homepage: c.homepage || c.documentation || c.repository,
        lastPublished: c.updated_at,
        createdAt: c.created_at,
      })),
      totalCount: crates.length,
      source: "crates",
    };
  } catch (error) {
    console.error("crates.io search error:", error);
    return { projects: [], totalCount: 0, source: "crates" };
  }
}

export async function searchPackagist(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://packagist.org/search.json?q=${encodeURIComponent(query)}&per_page=40`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "packagist" };
    const data = await response.json();
    const results = data.results || [];
    return {
      projects: results.map((p: any) => ({
        id: `packagist-${p.name}`,
        source: "packagist" as const,
        name: p.name.split("/").pop() || p.name,
        fullName: p.name,
        description: p.description || null,
        url: p.url,
        stars: 0,
        downloads: p.downloads || 0,
        language: "PHP",
        topics: [],
        author: {
          name: p.name.split("/")[0] || "unknown",
          avatar: "",
        },
        updatedAt: "",
      })),
      totalCount: results.length,
      source: "packagist",
    };
  } catch (error) {
    console.error("Packagist search error:", error);
    return { projects: [], totalCount: 0, source: "packagist" };
  }
}

export async function searchRubyGems(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "rubygems" };
    const gems = await response.json();
    return {
      projects: (Array.isArray(gems) ? gems : []).slice(0, 40).map((g: any) => ({
        id: `rubygems-${g.name}`,
        source: "rubygems" as const,
        name: g.name,
        fullName: g.name,
        description: g.info || null,
        url: `https://rubygems.org/gems/${g.name}`,
        stars: 0,
        downloads: g.downloads || 0,
        language: "Ruby",
        topics: [],
        author: {
          name: (g.authors || "unknown").split(",")[0].trim(),
          avatar: "",
        },
        updatedAt: g.version_created_at || "",
        license: Array.isArray(g.licenses) ? g.licenses.join(", ") : g.licenses,
        version: g.version,
        homepage: g.homepage_uri || g.source_code_uri,
        lastPublished: g.version_created_at,
      })),
      totalCount: Array.isArray(gems) ? gems.length : 0,
      source: "rubygems",
    };
  } catch (error) {
    console.error("RubyGems search error:", error);
    return { projects: [], totalCount: 0, source: "rubygems" };
  }
}

export async function searchJSR(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://api.jsr.io/packages?query=${encodeURIComponent(query)}&limit=30`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "jsr" };
    const data = await response.json();
    const items = data.items || [];
    return {
      projects: items.map((p: any) => {
        const full = `@${p.scope}/${p.name}`;
        return {
          id: `jsr-${full}`,
          source: "jsr" as const,
          name: p.name,
          fullName: full,
          description: p.description || null,
          url: `https://jsr.io/${full}`,
          // JSR has no stars and `p.score` is a 0-100 package-health score, not
          // a star count — route it through the normalized 0..1 popularity
          // channel instead of faking a star total (parity with the npm fix).
          stars: 0,
          downloads: 0,
          popularityScore:
            typeof p.score === "number"
              ? Math.max(0, Math.min(p.score, 100)) / 100
              : undefined,
          language: "TypeScript",
          topics: [],
          author: { name: `@${p.scope}`, avatar: "" },
          updatedAt: p.updatedAt || p.latestVersion?.publishedAt || "",
        };
      }),
      totalCount: items.length,
      source: "jsr",
    };
  } catch (error) {
    console.error("JSR search error:", error);
    return { projects: [], totalCount: 0, source: "jsr" };
  }
}

// --- Container / app / OS package catalogues ---

export async function searchDockerHub(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const response = await fetchViaProxy(
      `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(query)}&page_size=30`,
      signal,
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "dockerhub" };
    const data = await response.json();
    const results = data.results || [];
    return {
      projects: results.map((r: any) => {
        const repoName: string = r.repo_name || "";
        const [owner, name] = repoName.includes("/")
          ? repoName.split("/", 2)
          : ["library", repoName];
        // DockerHub's /v2/search/repositories/ response carries NO
        // last_updated field at all (live-verified: only is_official,
        // pull_count, repo_name, star_count, …) — the `|| ""` fallback
        // below therefore always yields "", which the card caption
        // suppresses cleanly and the ranker treats as an explicit
        // no-recency-signal. Real recency would need a per-result
        // /v2/repositories/{ns}/{name}/ lookup (latency cost), so it
        // stays off until a feature-flagged opt-in lands.
        return {
          id: `dockerhub-${repoName}`,
          source: "dockerhub" as const,
          name,
          fullName: repoName,
          description: r.short_description || null,
          // Official (library-namespace) images live at /_/<name>, NOT
          // /r/_/<name> — the /r/ prefix is only for user/org namespaces.
          // The old `/r/_/<name>` construction 400'd on every official image
          // (verified by curl 2026-06-10: /r/_/nginx → 400, /_/nginx → 200).
          url:
            owner === "library"
              ? `https://hub.docker.com/_/${name}`
              : `https://hub.docker.com/r/${owner}/${name}`,
          stars: r.star_count || 0,
          downloads: r.pull_count || 0,
          language: null,
          topics: [],
          author: { name: owner, avatar: "" },
          updatedAt: r.last_updated || "",
        };
      }),
      totalCount: results.length,
      source: "dockerhub",
    };
  } catch (error) {
    console.error("Docker Hub search error:", error);
    return { projects: [], totalCount: 0, source: "dockerhub" };
  }
}

export async function searchFlathub(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // Flathub's search is POST-only — GET /api/v2/search returns 405
    // (verified by curl 2026-06-10) — with a Meilisearch-style envelope:
    // { hits: [{ app_id, name, summary, installs_last_month,
    //   updated_at <unix seconds>, icon, developer_name, main_categories }] }.
    // Routed through the relay's dedicated POST passthrough (flathub.org is
    // the only POST-allowlisted host).
    const response = await postViaProxy(
      "https://flathub.org/api/v2/search",
      { query, filters: [] },
      signal,
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "flathub" };
    const data = await response.json();
    const hits = data.hits || data.results || [];
    return {
      projects: hits.slice(0, 30).map((a: any) => ({
        id: `flathub-${a.app_id || a.id}`,
        source: "flathub" as const,
        name: a.name || a.app_id,
        fullName: a.app_id || a.id,
        description: a.summary || a.description || null,
        url: `https://flathub.org/apps/${a.app_id || a.id}`,
        stars: 0,
        downloads: a.installs_last_month || 0,
        language: null,
        topics: a.main_categories || a.categories || [],
        author: {
          name: a.developer_name || "Flathub",
          avatar: a.icon || "",
        },
        // updated_at is unix SECONDS (a number), not an ISO string — convert,
        // and never let an unexpected shape throw out of the map.
        updatedAt:
          typeof a.updated_at === "number"
            ? safeIso(a.updated_at * 1000)
            : safeIso(a.updated_at),
        license: a.project_license || undefined,
      })),
      totalCount: hits.length,
      source: "flathub",
    };
  } catch (error) {
    console.error("Flathub search error:", error);
    return { projects: [], totalCount: 0, source: "flathub" };
  }
}

export async function searchHomebrew(query: string, signal?: AbortSignal): Promise<SearchResult> {
  const data = await callBackend<{ results: any[] }>("/search-homebrew", { query }, signal);
  if (!data) return { projects: [], totalCount: 0, source: "homebrew" };
  const results = data.results || [];
  return {
    projects: results.map((p: any) => {
      // Backend's `version` is the formula's `versions.stable` or the cask's
      // top-level `version`. Surfacing it as `project.version` lights up the
      // header version chip with parity to npm/pypi/crates/etc.
      // The legacy `updated` field is *not* a timestamp — it mirrors
      // `version` for back-compat but isn't usable as `updatedAt`. Brew.sh
      // doesn't expose a real updated-at on its index, so we leave
      // updatedAt empty and let UI consumers (caption, maintenance pill)
      // skip rendering rather than show a misleading "just now".
      const version: string | undefined = p.version || p.updated || undefined;
      return {
        id: `homebrew-${p.kind}-${p.full_token}`,
        source: "homebrew" as const,
        name: p.name || p.full_token,
        fullName: p.full_token,
        description: p.desc
          ? `${p.kind === "cask" ? "Cask" : "Formula"} • ${p.desc}`
          : null,
        url: p.homepage,
        stars: 0,
        language: null,
        topics: [p.kind, p.tap].filter(Boolean),
        author: { name: p.tap || "homebrew", avatar: "" },
        updatedAt: "",
        version,
      };
    }),
    totalCount: results.length,
    source: "homebrew",
  };
}

export async function searchFDroid(query: string, signal?: AbortSignal): Promise<SearchResult> {
  const data = await callBackend<{ results: any[] }>("/search-fdroid", { query }, signal);
  if (!data) return { projects: [], totalCount: 0, source: "fdroid" };
  const results = data.results || [];
  return {
    projects: results.map((a: any) => ({
      id: `fdroid-${a.id}`,
      source: "fdroid" as const,
      name: a.name || a.id,
      fullName: a.id,
      description: a.summary || a.description?.slice(0, 200) || null,
      url: `https://f-droid.org/en/packages/${a.id}/`,
      stars: 0,
      language: null,
      topics: a.categories || [],
      author: {
        name: a.author || "F-Droid",
        avatar: a.icon || "",
      },
      updatedAt: a.updated || "",
      license: a.license ?? undefined,
    })),
    totalCount: results.length,
    source: "fdroid",
  };
}

export async function searchVcpkg(query: string, signal?: AbortSignal): Promise<SearchResult> {
  // vcpkg.io has no search API — the dedicated Pages Function fetches the
  // full port index (edge-cached 24h) and filters server-side; see
  // functions/api/search-vcpkg.ts. callBackend never throws.
  const data = await callBackend<{ results: any[] }>("/search-vcpkg", { query }, signal);
  if (!data) return { projects: [], totalCount: 0, source: "vcpkg" };
  const results = data.results || [];
  return {
    projects: results.map((p: any) => ({
      id: `vcpkg-${p.name}`,
      source: "vcpkg" as const,
      name: p.name || "",
      fullName: p.name || "",
      description: p.desc || null,
      url: `https://vcpkg.io/en/package/${p.name}`,
      // vcpkg's index exposes NO stars and NO download counts — leave both
      // honestly empty rather than inventing a popularity signal.
      stars: 0,
      language: "C/C++",
      topics: [],
      author: { name: "vcpkg", avatar: "" },
      // Backend ships `updated` as ISO derived from the index's LastModified
      // — a real last-touched signal (unlike Homebrew, which has none).
      updatedAt: p.updated || "",
      license: p.license ?? undefined,
      version: p.version || undefined,
      // The port's own project site, when the index carries one.
      homepage: p.homepage || undefined,
    })),
    totalCount: results.length,
    source: "vcpkg",
  };
}

export async function searchMelpa(query: string, signal?: AbortSignal): Promise<SearchResult> {
  // melpa.org has no search API — the dedicated Pages Function fetches the
  // full archive + download-counts files (edge-cached 24h), joins them by
  // name, and filters server-side; see functions/api/search-melpa.ts.
  const data = await callBackend<{ results: any[] }>("/search-melpa", { query }, signal);
  if (!data) return { projects: [], totalCount: 0, source: "melpa" };
  const results = data.results || [];
  return {
    projects: results.map((p: any) => ({
      id: `melpa-${p.name}`,
      source: "melpa" as const,
      name: p.name || "",
      fullName: p.name || "",
      description: p.desc || null,
      // Card links to the MELPA package page (SPA hash route); the upstream
      // repo (props.url) is surfaced separately as `homepage` below.
      url: `https://melpa.org/#/${p.name}`,
      stars: 0,
      // Cumulative install count from download_counts.json — MELPA's one
      // honest popularity signal.
      downloads: p.downloads || 0,
      language: "Emacs Lisp",
      topics: Array.isArray(p.keywords) ? p.keywords.slice(0, 6) : [],
      author: { name: "MELPA", avatar: "" },
      // ver[0] (YYYYMMDD snapshot build date) → ISO in the backend; "" when
      // unparseable, never a fake "just now".
      updatedAt: p.updated || "",
      version: p.version || undefined,
      homepage: p.repo || undefined,
    })),
    totalCount: results.length,
    source: "melpa",
  };
}

export async function searchAUR(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const url = `https://aur.archlinux.org/rpc/?v=5&type=search&by=name-desc&arg=${encodeURIComponent(query)}`;
    const response = await fetchViaProxy(url, signal);
    if (!response.ok) return { projects: [], totalCount: 0, source: "aur" };
    const data = (await response.json()) as { results?: any[] };
    const results = (data?.results || []).slice(0, 25);
    return {
      projects: results.map((p: any) => ({
        id: `aur-${p.ID}`,
        source: "aur" as const,
        name: p.Name,
        fullName: p.Name,
        description: p.Description || null,
        url: `https://aur.archlinux.org/packages/${p.Name}`,
        stars: p.NumVotes || 0,
        downloads: undefined,
        language: null,
        topics: (p.Keywords || []).slice(0, 6),
        author: {
          name: p.Maintainer || "orphaned",
          avatar: "",
        },
        updatedAt: p.LastModified ? safeIso(p.LastModified * 1000) : "",
        license: Array.isArray(p.License) ? p.License[0] : p.License,
      })),
      totalCount: results.length,
      source: "aur",
    };
  } catch (error) {
    console.error("AUR search error:", error);
    return { projects: [], totalCount: 0, source: "aur" };
  }
}

export async function searchOpenVsx(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const url = `https://open-vsx.org/api/-/search?query=${encodeURIComponent(query)}&size=25&sortBy=relevance&sortOrder=desc`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Open VSX ${res.status}`);
    const data = (await res.json()) as { extensions: any[] };
    const results = data.extensions || [];
    return {
      projects: results.map((ext: any) => ({
        id: `openvsx-${ext.namespace}.${ext.name}`,
        source: "openvsx" as const,
        name: ext.displayName || ext.name,
        fullName: `${ext.namespace}/${ext.name}`,
        description: ext.description || null,
        url: ext.url || `https://open-vsx.org/extension/${ext.namespace}/${ext.name}`,
        stars: 0,
        downloads: ext.downloadCount || 0,
        language: null,
        topics: [ext.namespace].concat((ext.categories || []).slice(0, 3)).filter(Boolean),
        author: { name: ext.namespace || "unknown", avatar: "" },
        updatedAt: ext.timestamp || "",
        license: ext.license ?? undefined,
      })),
      totalCount: results.length,
      source: "openvsx",
    };
  } catch (error) {
    console.error("Open VSX search error:", error);
    return { projects: [], totalCount: 0, source: "openvsx" };
  }
}

export async function searchCondaForge(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const url = `https://api.anaconda.org/search?name=${encodeURIComponent(query)}`;
    const response = await fetchViaProxy(url, signal);
    if (!response.ok) return { projects: [], totalCount: 0, source: "conda" };
    const data = (await response.json()) as any[];
    if (!Array.isArray(data)) return { projects: [], totalCount: 0, source: "conda" };
    // Prefer conda-forge + bioconda channels; cap at 25.
    const filtered = data
      .filter((p: any) => p.owner === "conda-forge" || p.owner === "bioconda")
      .slice(0, 25);
    return {
      projects: filtered.map((p: any) => ({
        id: `conda-${p.owner}-${p.name}`,
        source: "conda" as const,
        name: p.name,
        fullName: `${p.owner}/${p.name}`,
        description: p.summary || null,
        url: `https://anaconda.org/${p.owner}/${p.name}`,
        stars: 0,
        downloads: p.total_downloads || 0,
        language: null,
        topics: [p.owner],
        author: { name: p.owner, avatar: "" },
        updatedAt: p.latest_version_timestamp || "",
      })),
      totalCount: filtered.length,
      source: "conda",
    };
  } catch (error) {
    console.error("conda-forge search error:", error);
    return { projects: [], totalCount: 0, source: "conda" };
  }
}

export async function searchNuGet(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const url = `https://azuresearch-usnc.nuget.org/query?q=${encodeURIComponent(query)}&take=30&prerelease=false`;
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
    if (!response.ok) return { projects: [], totalCount: 0, source: "nuget" };
    const data = await response.json();
    const results: any[] = data.data || [];
    return {
      projects: results.map((p: any) => ({
        id: `nuget-${p.id}`,
        source: "nuget" as const,
        name: p.id,
        fullName: p.id,
        description: p.description || p.summary || null,
        url: `https://www.nuget.org/packages/${p.id}`,
        stars: 0,
        downloads: p.totalDownloads || 0,
        language: "C#",
        topics: Array.isArray(p.tags) ? p.tags.slice(0, 6) : [],
        author: {
          name: Array.isArray(p.authors) ? p.authors[0] : p.authors || "unknown",
          avatar: p.iconUrl || "",
        },
        updatedAt: p.lastUpdated || "",
        license: p.licenseUrl,
        version: p.version,
        homepage: p.projectUrl,
      })),
      totalCount: results.length,
      source: "nuget",
    };
  } catch (error) {
    console.error("NuGet search error:", error);
    return { projects: [], totalCount: 0, source: "nuget" };
  }
}

export async function searchZenodo(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // Prefer "software" records — the ones most likely to interest an
    // open-source searcher. Fall back to datasets if software returns
    // nothing. Publications (papers) already covered by arXiv.
    // type must be REPEATED, not comma-joined — `type=software,dataset`
    // matches nothing upstream (verified live: 0 hits for every query vs 168
    // for the repeated form).
    const url = `https://zenodo.org/api/records?q=${encodeURIComponent(query)}&size=25&sort=mostrecent&type=software&type=dataset`;
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
    if (!response.ok) return { projects: [], totalCount: 0, source: "zenodo" };
    const data = await response.json();
    const hits: any[] = data.hits?.hits || [];
    return {
      projects: hits.map((r: any) => {
        const m = r.metadata || {};
        const creators: any[] = m.creators || [];
        // Zenodo has no stars; unique_views is a *view* count. Surfacing it
        // as `stars` made "★ 12,000" appear beside genuine GitHub stars
        // (no-fake-stars policy violation, same class as the old npm
        // quality*1000 bug). Feed it to the ranker via the normalized 0..1
        // popularity channel instead: 10k unique views ≈ a genuinely popular
        // record, so clamp views/10k into [0,1].
        const uniqueViews = r.stats?.unique_views;
        return {
          id: `zenodo-${r.id}`,
          source: "zenodo" as const,
          name: m.title || `Zenodo record ${r.id}`,
          fullName: r.doi || `zenodo:${r.id}`,
          description: m.description ? stripHtml(String(m.description)).slice(0, 300) : null,
          url: r.links?.self_html || r.doi_url || `https://zenodo.org/records/${r.id}`,
          stars: 0,
          popularityScore:
            typeof uniqueViews === "number"
              ? Math.min(Math.max(uniqueViews, 0) / 10_000, 1)
              : undefined,
          downloads: r.stats?.unique_downloads || r.stats?.downloads || 0,
          language: null,
          topics: (m.keywords || []).slice(0, 6),
          author: {
            name: creators[0]?.name || "unknown",
            avatar: "",
          },
          updatedAt: r.updated || r.created || m.publication_date || "",
          license: m.license?.id,
        };
      }),
      totalCount: hits.length,
      source: "zenodo",
    };
  } catch (error) {
    console.error("Zenodo search error:", error);
    return { projects: [], totalCount: 0, source: "zenodo" };
  }
}

export async function searchMaven(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // Maven Central's Solr endpoint. `rows=30` matches our other registry
    // adapters; `wt=json` is required (the default is XML). Response shape:
    //   response.docs[] with { id, g, a, latestVersion, p, timestamp, versionCount }
    const url = `https://search.maven.org/solrsearch/select?q=${encodeURIComponent(query)}&rows=30&wt=json`;
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
    if (!response.ok) return { projects: [], totalCount: 0, source: "maven" };
    const data = await response.json();
    const docs: any[] = data.response?.docs || [];
    return {
      projects: docs.map((p: any) => {
        const coord = `${p.g}:${p.a}`;
        return {
          id: `maven-${coord}`,
          source: "maven" as const,
          name: p.a,
          fullName: coord,
          description: `${p.p || "jar"} · ${p.versionCount || 0} versions`,
          url: `https://central.sonatype.com/artifact/${encodeURIComponent(p.g)}/${encodeURIComponent(p.a)}`,
          stars: 0,
          // Maven Central exposes no download counts and versionCount is NOT
          // popularity (a release cadence at best — guava's 52 versions vs a
          // 9-billion-download artifact with 5). Mapping it into `downloads`
          // both mis-ranked and rendered "52 downloads" in the metric grid.
          // Leave downloads unset; BM25 text relevance + the source baseline
          // carry Maven ranking honestly.
          language: "Java",
          topics: [],
          author: {
            name: p.g,
            avatar: "",
          },
          updatedAt: p.timestamp ? safeIso(p.timestamp) : "",
          version: p.latestVersion,
        };
      }),
      // numFound is the corpus-wide Solr match count (can be 6 digits for a
      // generic term), not "results in this response" like every other
      // adapter reports — surfacing it inflated the per-source result badge.
      totalCount: docs.length,
      source: "maven",
    };
  } catch (error) {
    console.error("Maven Central search error:", error);
    return { projects: [], totalCount: 0, source: "maven" };
  }
}

export async function searchHex(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // hex.pm has a clean search API but no browser CORS — proxy it. One call
    // returns rich metadata (description, downloads, license, version, repo).
    const url = `https://hex.pm/api/packages?search=${encodeURIComponent(query)}&sort=recent_downloads`;
    const response = await fetchViaProxy(url, signal);
    if (!response.ok) return { projects: [], totalCount: 0, source: "hex" };
    const data = await response.json();
    const pkgs: any[] = Array.isArray(data) ? data.slice(0, 30) : [];
    return {
      projects: pkgs.map((p: any) => {
        const meta = p.meta || {};
        const dl = p.downloads || {};
        return {
          id: `hex-${p.name}`,
          source: "hex" as const,
          name: p.name,
          fullName: p.name,
          description: meta.description || null,
          url: p.html_url || `https://hex.pm/packages/${p.name}`,
          stars: 0,
          downloads: dl.all || dl.recent || 0,
          weeklyDownloads: dl.week,
          language: "Elixir",
          topics: [],
          author: { name: "hex.pm", avatar: "" },
          updatedAt: p.updated_at || "",
          license: Array.isArray(meta.licenses) ? meta.licenses.join(", ") : undefined,
          version: p.latest_stable_version || p.latest_version,
          homepage: meta.links?.GitHub || p.docs_html_url || undefined,
          lastPublished: p.updated_at,
          createdAt: p.inserted_at,
        };
      }),
      totalCount: pkgs.length,
      source: "hex",
    };
  } catch (error) {
    console.error("Hex search error:", error);
    return { projects: [], totalCount: 0, source: "hex" };
  }
}

export async function searchWordPress(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // api.wordpress.org ignores browser CORS, so proxy it. Edge-cache via
    // the proxy keeps common queries cheap.
    const target = `https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&request%5Bsearch%5D=${encodeURIComponent(query)}&request%5Bper_page%5D=25`;
    const response = await fetchViaProxy(target, signal);
    if (!response.ok) return { projects: [], totalCount: 0, source: "wordpress" };
    const data = await response.json();
    const plugins: any[] = data.plugins || [];
    return {
      projects: plugins.map((p: any) => ({
        id: `wordpress-${p.slug}`,
        source: "wordpress" as const,
        name: decodeHtml(p.name || p.slug),
        fullName: p.slug,
        description: p.short_description
          ? stripHtml(decodeHtml(String(p.short_description))).slice(0, 300)
          : null,
        url: `https://wordpress.org/plugins/${p.slug}/`,
        // WP plugins have no stars; rating is a quality metric (not popularity)
        // and active_installs is the real popularity signal -> downloads below.
        // Faking a 0-5 "star" count both mis-ranked and rendered "★ 5" beside
        // a GitHub "★ 45,231". Leave stars empty.
        stars: 0,
        downloads: p.active_installs || p.downloaded || 0,
        language: "PHP",
        topics: Object.keys(p.tags || {}).slice(0, 6),
        author: {
          name: stripHtml(decodeHtml(p.author || "")) || "unknown",
          avatar: p.icons?.["1x"] || p.icons?.default || "",
        },
        // last_updated arrives as "2026-04-01 4:54pm GMT" — see
        // parseWordPressDate. The old replace()+toISOString() chain threw a
        // RangeError on that 12-hour format, blanking the entire source.
        updatedAt: parseWordPressDate(p.last_updated),
      })),
      totalCount: plugins.length,
      source: "wordpress",
    };
  } catch (error) {
    console.error("WordPress plugins search error:", error);
    return { projects: [], totalCount: 0, source: "wordpress" };
  }
}

export async function searchModrinth(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // Modrinth's API is fully CORS-enabled (Access-Control-Allow-Origin: *,
    // curl-verified 2026-06-10) — direct fetch, no proxy hop needed.
    const response = await fetch(
      `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=20`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "modrinth" };
    const data = await response.json();
    const hits: any[] = Array.isArray(data.hits) ? data.hits : [];
    return {
      projects: hits.map((h: any) => ({
        id: `modrinth-${h.project_id || h.slug || h.title}`,
        source: "modrinth" as const,
        name: h.title || h.slug || "",
        fullName: h.slug || h.title || "",
        description: h.description || null,
        url: `https://modrinth.com/${h.project_type || "mod"}/${h.slug}`,
        // No stars on Modrinth — `downloads` is the honest popularity signal
        // (follows is tiny by comparison and would just dilute it).
        stars: 0,
        downloads: h.downloads || 0,
        language: null,
        topics: Array.isArray(h.display_categories)
          ? h.display_categories.slice(0, 6)
          : Array.isArray(h.categories)
            ? h.categories.slice(0, 6)
            : [],
        author: { name: h.author || "unknown", avatar: h.icon_url || "" },
        updatedAt: safeIso(h.date_modified),
        license: typeof h.license === "string" ? h.license : undefined,
        createdAt: h.date_created,
      })),
      totalCount: hits.length,
      source: "modrinth",
    };
  } catch (error) {
    console.error("Modrinth search error:", error);
    return { projects: [], totalCount: 0, source: "modrinth" };
  }
}

export async function searchCRAN(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // search.r-pkg.org (METACRAN) exposes CRAN metadata through a plain
    // Elasticsearch endpoint. No browser CORS — proxy it.
    const response = await fetchViaProxy(
      `https://search.r-pkg.org/package/_search?q=${encodeURIComponent(query)}&size=20`,
      signal,
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "cran" };
    const data = await response.json();
    const hits: any[] = data?.hits?.hits || [];
    return {
      projects: hits.map((h: any) => {
        const s = h._source || {};
        const name = s.Package || h._id || "";
        // _source.URL is a comma/space-separated list — first entry is the
        // project homepage (usually the GitHub repo).
        const homepage =
          typeof s.URL === "string" ? s.URL.split(/[,\s]+/)[0] : undefined;
        return {
          id: `cran-${name}`,
          source: "cran" as const,
          name,
          fullName: name,
          description:
            [s.Title, s.Description]
              .filter(Boolean)
              .join(" — ")
              .replace(/\s+/g, " ")
              .slice(0, 300) || null,
          url: `https://cran.r-project.org/package=${encodeURIComponent(name)}`,
          stars: 0,
          // METACRAN's `downloads` is last-month CRAN downloads — honest.
          downloads: s.downloads || 0,
          language: "R",
          topics: [],
          author: { name: "CRAN", avatar: "" },
          updatedAt: safeIso(s.date),
          license: s.License || undefined,
          version: s.Version || undefined,
          homepage: homepage || undefined,
          lastPublished: safeIso(s.date) || undefined,
        };
      }),
      totalCount: hits.length,
      source: "cran",
    };
  } catch (error) {
    console.error("CRAN search error:", error);
    return { projects: [], totalCount: 0, source: "cran" };
  }
}

// AMO localized fields arrive either as plain strings or as {locale: value}
// objects. `lang=en-US` is documented to flatten them, but live responses
// still return objects (curl-verified 2026-06-10) — unwrap both shapes.
function amoLocalized(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const first = o["en-US"] ?? Object.values(o)[0];
    return typeof first === "string" ? first : "";
  }
  return "";
}

export async function searchAMO(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // addons.mozilla.org API v5 is CORS-enabled (Access-Control-Allow-Origin:
    // *, curl-verified 2026-06-10) — direct fetch.
    const response = await fetch(
      `https://addons.mozilla.org/api/v5/addons/search/?q=${encodeURIComponent(query)}&page_size=20&app=firefox&lang=en-US`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "amo" };
    const data = await response.json();
    const results: any[] = Array.isArray(data.results) ? data.results : [];
    return {
      projects: results.map((r: any) => {
        const name = amoLocalized(r.name) || r.slug || "";
        const cv = r.current_version || {};
        return {
          id: `amo-${r.id ?? r.slug ?? name}`,
          source: "amo" as const,
          name,
          fullName: r.slug || name,
          description: amoLocalized(r.summary) || null,
          url: r.url || `https://addons.mozilla.org/en-US/firefox/addon/${r.slug}/`,
          // No stars; ADU (average daily users) is AMO's real adoption signal
          // — same channel WordPress uses for active_installs. Never fake the
          // 0-5 review rating into a star count.
          stars: 0,
          downloads: r.average_daily_users || 0,
          weeklyDownloads: r.weekly_downloads || undefined,
          language: null,
          topics: Array.isArray(r.categories) ? r.categories.slice(0, 6) : [],
          author: {
            name: r.authors?.[0]?.name || "unknown",
            avatar: r.icon_url || "",
          },
          updatedAt: safeIso(r.last_updated),
          license: cv.license?.slug || amoLocalized(cv.license?.name) || undefined,
          version: cv.version || undefined,
          homepage: amoLocalized(r.homepage?.url ?? r.homepage) || undefined,
          createdAt: r.created,
        };
      }),
      totalCount: results.length,
      source: "amo",
    };
  } catch (error) {
    console.error("Firefox Add-ons search error:", error);
    return { projects: [], totalCount: 0, source: "amo" };
  }
}

export async function searchGreasyFork(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // api.greasyfork.org is CORS-enabled (Access-Control-Allow-Origin: *,
    // curl-verified 2026-06-10). The response is a bare ARRAY with no
    // page-size param — pages run ~95KB, so cap to 20 client-side.
    const response = await fetch(
      `https://api.greasyfork.org/en/scripts.json?q=${encodeURIComponent(query)}&page=1`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "greasyfork" };
    const data = await response.json();
    const scripts: any[] = (Array.isArray(data) ? data : []).slice(0, 20);
    return {
      projects: scripts.map((s: any) => ({
        id: `greasyfork-${s.id ?? s.name}`,
        source: "greasyfork" as const,
        name: s.name || "",
        fullName: s.name || "",
        description: s.description || null,
        url: s.url || `https://greasyfork.org/en/scripts/${s.id}`,
        stars: 0,
        downloads: s.total_installs || 0,
        language: "JavaScript",
        topics: [],
        author: { name: s.users?.[0]?.name || "unknown", avatar: "" },
        updatedAt: safeIso(s.code_updated_at),
        license: s.license || undefined,
        version: s.version || undefined,
        createdAt: s.created_at,
      })),
      totalCount: scripts.length,
      source: "greasyfork",
    };
  } catch (error) {
    console.error("Greasy Fork search error:", error);
    return { projects: [], totalCount: 0, source: "greasyfork" };
  }
}

export async function searchTerraform(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // registry.terraform.io has no browser CORS — proxy it.
    const response = await fetchViaProxy(
      `https://registry.terraform.io/v1/modules/search?q=${encodeURIComponent(query)}&limit=20`,
      signal,
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "terraform" };
    const data = await response.json();
    const modules: any[] = Array.isArray(data.modules) ? data.modules : [];
    return {
      projects: modules.map((m: any) => {
        const full = `${m.namespace}/${m.name}/${m.provider}`;
        return {
          id: `terraform-${m.id || full}`,
          source: "terraform" as const,
          name: m.name || "",
          fullName: full,
          description: m.description || null,
          url: `https://registry.terraform.io/modules/${full}`,
          stars: 0,
          downloads: m.downloads || 0,
          language: "HCL",
          topics: m.provider ? [String(m.provider)] : [],
          author: { name: m.namespace || "unknown", avatar: "" },
          updatedAt: safeIso(m.published_at),
          version: m.version || undefined,
          homepage: m.source || undefined,
          lastPublished: safeIso(m.published_at) || undefined,
        };
      }),
      totalCount: modules.length,
      source: "terraform",
    };
  } catch (error) {
    console.error("Terraform Registry search error:", error);
    return { projects: [], totalCount: 0, source: "terraform" };
  }
}

export async function searchSnapcraft(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // api.snapcraft.io requires the Snap-Device-Series header (the proxy
    // injects it via its per-host extra-headers map) and an explicit `fields`
    // param — without `fields` the find endpoint returns names only.
    const response = await fetchViaProxy(
      `https://api.snapcraft.io/v2/snaps/find?q=${encodeURIComponent(query)}&fields=title,summary,store-url,version,publisher,license,media`,
      signal,
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "snap" };
    const data = await response.json();
    const results: any[] = Array.isArray(data.results) ? data.results : [];
    return {
      projects: results.slice(0, 20).map((r: any) => {
        const s = r.snap || {};
        const icon = Array.isArray(s.media)
          ? s.media.find((mm: any) => mm?.type === "icon")?.url || ""
          : "";
        return {
          id: `snap-${r.name || s.title}`,
          source: "snap" as const,
          name: s.title || r.name || "",
          fullName: r.name || s.title || "",
          description: s.summary || null,
          url: s["store-url"] || `https://snapcraft.io/${r.name}`,
          // Snapcraft's find API exposes no stars and no install counts —
          // leave both empty rather than inventing a signal.
          stars: 0,
          language: null,
          topics: [],
          author: {
            name: s.publisher?.["display-name"] || s.publisher?.username || "unknown",
            avatar: icon,
          },
          updatedAt: "",
          license: s.license || undefined,
          version: r.revision?.version || undefined,
        };
      }),
      totalCount: results.length,
      source: "snap",
    };
  } catch (error) {
    console.error("Snapcraft search error:", error);
    return { projects: [], totalCount: 0, source: "snap" };
  }
}

export async function searchAnsibleGalaxy(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // galaxy.ansible.com v3 search; no browser CORS — proxy it. NOTE:
    // `order_by=-download_count` was retired upstream ("not one of the
    // available choices", curl-verified 2026-06-10) — default ordering is
    // relevance, and the payload exposes no download metric at all, so we
    // honestly ship none. is_highest=true keeps one row per collection.
    const response = await fetchViaProxy(
      `https://galaxy.ansible.com/api/v3/plugin/ansible/search/collection-versions/?keywords=${encodeURIComponent(query)}&limit=20&is_highest=true`,
      signal,
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "ansible" };
    const data = await response.json();
    const items: any[] = (Array.isArray(data.data) ? data.data : []).filter(
      (it: any) => !it?.is_deprecated,
    );
    return {
      projects: items.map((it: any) => {
        const cv = it.collection_version || {};
        const full = `${cv.namespace}.${cv.name}`;
        return {
          id: `ansible-${full}`,
          source: "ansible" as const,
          name: cv.name || "",
          fullName: full,
          description: cv.description || null,
          url: `https://galaxy.ansible.com/ui/repo/published/${cv.namespace}/${cv.name}/`,
          stars: 0,
          language: null,
          // tags arrive as [{name: "docker"}, …] objects (live-verified) — a bare
          // String() coerced them to "[object Object]" chips.
          topics: Array.isArray(cv.tags)
            ? cv.tags
                .slice(0, 6)
                .map((t: unknown) =>
                  typeof t === "string"
                    ? t
                    : String((t as { name?: unknown })?.name ?? ""),
                )
                .filter(Boolean)
            : [],
          author: { name: cv.namespace || "unknown", avatar: "" },
          updatedAt: safeIso(cv.pulp_created),
          version: cv.version || undefined,
          lastPublished: safeIso(cv.pulp_created) || undefined,
        };
      }),
      totalCount: items.length,
      source: "ansible",
    };
  } catch (error) {
    console.error("Ansible Galaxy search error:", error);
    return { projects: [], totalCount: 0, source: "ansible" };
  }
}

export async function searchGnomeExtensions(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // extensions.gnome.org has no browser CORS — proxy it. `link` and `icon`
    // come back site-relative and need the https://extensions.gnome.org prefix.
    const response = await fetchViaProxy(
      `https://extensions.gnome.org/extension-query/?search=${encodeURIComponent(query)}&page=1`,
      signal,
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "gnome" };
    const data = await response.json();
    const exts: any[] = Array.isArray(data.extensions) ? data.extensions : [];
    const abs = (p: unknown): string => {
      if (typeof p !== "string" || !p) return "";
      return p.startsWith("http") ? p : `https://extensions.gnome.org${p}`;
    };
    return {
      projects: exts.slice(0, 20).map((e: any) => ({
        id: `gnome-${e.uuid || e.pk || e.name}`,
        source: "gnome" as const,
        name: e.name || "",
        fullName: e.uuid || e.name || "",
        description: e.description
          ? String(e.description).replace(/\s+/g, " ").slice(0, 300)
          : null,
        url: abs(e.link) || `https://extensions.gnome.org/extension/${e.pk}/`,
        stars: 0,
        downloads: e.downloads || 0,
        language: "JavaScript",
        topics: [],
        author: { name: e.creator || "unknown", avatar: abs(e.icon) },
        updatedAt: "",
        // e.url (when present) is the project's own repo/homepage.
        homepage: typeof e.url === "string" && e.url ? e.url : undefined,
      })),
      totalCount: exts.length,
      source: "gnome",
    };
  } catch (error) {
    console.error("GNOME Extensions search error:", error);
    return { projects: [], totalCount: 0, source: "gnome" };
  }
}

export async function searchChocolatey(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // Chocolatey's community feed is OData v2 — an Atom XML feed, not JSON.
    // The exact param shape matters (it 400s without targetFramework /
    // includePrerelease) so keep it verbatim; only the quoted searchTerm is
    // URL-encoded. Parsed with the same regex-walk approach as
    // functions/api/search-arxiv.ts — no DOMParser dependency.
    const target =
      "https://community.chocolatey.org/api/v2/Search()?$filter=IsLatestVersion&$top=20" +
      `&searchTerm=${encodeURIComponent(`'${query.replace(/'/g, "''")}'`)}` +
      "&targetFramework=''&includePrerelease=false";
    const response = await fetchViaProxy(target, signal);
    if (!response.ok) return { projects: [], totalCount: 0, source: "chocolatey" };
    const xml = await response.text();
    const tag = (src: string, name: string): string => {
      const mm = src.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
      return mm ? mm[1].trim() : "";
    };
    const entries: string[] = [];
    const entryRe = /<entry[\s>]([\s\S]*?)<\/entry>/g;
    let m: RegExpExecArray | null;
    while ((m = entryRe.exec(xml)) !== null) entries.push(m[1]);
    const projects = entries
      .map((e) => {
        // <title> carries the package id; <d:Title> the display name.
        const pkgId = tag(e, "title") || (e.match(/Id='([^']+)'/)?.[1] ?? "");
        const display = decodeHtml(tag(e, "d:Title")) || pkgId;
        if (!pkgId && !display) return null;
        const downloads = parseInt(tag(e, "d:DownloadCount"), 10);
        const author = e.match(/<author>\s*<name>([^<]*)/)?.[1]?.trim() || "unknown";
        return {
          id: `chocolatey-${pkgId || display}`,
          source: "chocolatey" as const,
          name: display,
          fullName: pkgId || display,
          description:
            stripHtml(decodeHtml(tag(e, "d:Description"))).slice(0, 300) || null,
          url:
            tag(e, "d:GalleryDetailsUrl") ||
            `https://community.chocolatey.org/packages/${pkgId}`,
          stars: 0,
          downloads: Number.isFinite(downloads) && downloads > 0 ? downloads : 0,
          language: null,
          topics: [],
          author: { name: author, avatar: "" },
          updatedAt: safeIso(tag(e, "d:Published")),
          version: tag(e, "d:Version") || undefined,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    return { projects, totalCount: projects.length, source: "chocolatey" };
  } catch (error) {
    console.error("Chocolatey search error:", error);
    return { projects: [], totalCount: 0, source: "chocolatey" };
  }
}

// --- Community threads ---

export async function searchHackerNews(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=40`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "hackernews" };
    const data = await response.json();
    const hits = data.hits || [];
    return {
      projects: hits
        .filter((h: any) => h.title && (h.url || h.story_text))
        .map((h: any) => ({
          id: `hn-${h.objectID}`,
          source: "hackernews" as const,
          name: h.title,
          fullName: `HN: ${h.title}`,
          description: h.story_text
            ? h.story_text.substring(0, 300).replace(/<[^>]+>/g, "")
            : null,
          url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
          stars: h.points || 0,
          language: null,
          topics: h._tags || [],
          author: { name: h.author || "anonymous", avatar: "" },
          updatedAt: h.created_at,
          commentsCount: h.num_comments || 0,
          upvotes: h.points || 0,
          comments: h.num_comments || 0,
          createdAt: h.created_at,
        })),
      totalCount: hits.length,
      source: "hackernews",
    };
  } catch (error) {
    console.error("Hacker News search error:", error);
    return { projects: [], totalCount: 0, source: "hackernews" };
  }
}

export async function searchReddit(query: string, signal?: AbortSignal): Promise<SearchResult> {
  try {
    const projects = await searchRedditViaBackend(query, signal);
    return {
      projects,
      totalCount: projects.length,
      source: "reddit",
    };
  } catch (error) {
    console.error("Reddit search error:", error);
    return { projects: [], totalCount: 0, source: "reddit" };
  }
}

export async function searchLobsters(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // DEGRADED MODE — lobste.rs no longer exposes a JSON search. Every
    // /search.json parameter combination returns HTTP 400 (curl-verified
    // 2026-06-10: ?q=…&what=stories&order=relevance, bare ?q=…, and the
    // /search?…&format=json variant all 400; only the HTML page works).
    // The best remaining JSON surface is the small hottest.json feed
    // (~25 stories), so we fetch that and filter client-side by query
    // tokens. Recall is limited to what's currently hot, but that beats a
    // permanently dead source — and hot stories are exactly the threads a
    // "what does the community think" search wants.
    const response = await fetchViaProxy("https://lobste.rs/hottest.json", signal);
    if (!response.ok) return { projects: [], totalCount: 0, source: "lobsters" };
    const data = await response.json();
    const stories: any[] = Array.isArray(data) ? data : [];
    const tokens = significantTokens(query);
    const matches = stories.filter((s: any) => {
      if (tokens.length === 0) return true;
      const hay = [
        s?.title || "",
        Array.isArray(s?.tags) ? s.tags.join(" ") : "",
        s?.description_plain || s?.description || "",
      ]
        .join(" ")
        .toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
    return {
      projects: matches.slice(0, 30).map((s: any) => ({
        id: `lobsters-${s.short_id || s.id}`,
        source: "lobsters" as const,
        name: s.title,
        fullName: `lobste.rs/${s.short_id || s.id}`,
        description: s.description_plain || stripHtml(String(s.description || "")) || null,
        url: s.url || s.comments_url || `https://lobste.rs/s/${s.short_id}`,
        stars: s.score || 0,
        commentsCount: s.comment_count || 0,
        language: null,
        topics: s.tags || [],
        author: {
          // hottest.json serves submitter_user as a plain username string;
          // older payloads used { username, avatar_url }. Accept both.
          name:
            typeof s.submitter_user === "string"
              ? s.submitter_user
              : s.submitter_user?.username || "unknown",
          avatar:
            typeof s.submitter_user === "object"
              ? s.submitter_user?.avatar_url || ""
              : "",
        },
        updatedAt: s.created_at || "",
        upvotes: s.score || 0,
        comments: s.comment_count || 0,
        createdAt: s.created_at,
      })),
      totalCount: matches.length,
      source: "lobsters",
    };
  } catch (error) {
    console.error("Lobsters search error:", error);
    return { projects: [], totalCount: 0, source: "lobsters" };
  }
}

export async function searchStackOverflow(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=30&filter=withbody`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "stackoverflow" };
    const data = await response.json();
    const items = data.items || [];
    return {
      projects: items.map((q: any) => ({
        id: `stackoverflow-${q.question_id}`,
        source: "stackoverflow" as const,
        name: decodeHtml(q.title || ""),
        fullName: `SO: ${decodeHtml(q.title || "")}`,
        description: q.body ? stripHtml(q.body).slice(0, 280) : null,
        url: q.link,
        stars: q.score || 0,
        commentsCount: q.answer_count || 0,
        language: null,
        topics: q.tags || [],
        author: {
          name: q.owner?.display_name || "unknown",
          avatar: q.owner?.profile_image || "",
        },
        updatedAt: q.last_activity_date ? safeIso(q.last_activity_date * 1000) : "",
        upvotes: q.score || 0,
        comments: q.answer_count || 0,
        createdAt: q.creation_date ? safeIso(q.creation_date * 1000) || undefined : undefined,
      })),
      totalCount: items.length,
      source: "stackoverflow",
    };
  } catch (error) {
    console.error("Stack Overflow search error:", error);
    return { projects: [], totalCount: 0, source: "stackoverflow" };
  }
}

export async function searchDevTo(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    // Dev.to has no search endpoint — it filters by a single tag, and tags are
    // single lowercase words. "rust web framework" mashed into one tag
    // ("rustwebframework") matched nothing; use the first significant token
    // ("rust") so multi-word queries actually return articles.
    const firstTok = significantTokens(query)[0];
    const tag = (firstTok || query.toLowerCase().replace(/[^a-z0-9]+/g, "")).slice(0, 40);
    if (!tag) return { projects: [], totalCount: 0, source: "devto" };
    const response = await fetch(
      `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=30&top=7`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "devto" };
    const items = (await response.json()) as any[];
    return {
      projects: (Array.isArray(items) ? items : []).map((a: any) => ({
        id: `devto-${a.id}`,
        source: "devto" as const,
        name: a.title,
        fullName: `@${a.user?.username || "unknown"}/${a.slug || a.id}`,
        description: a.description || null,
        url: a.url,
        stars: a.public_reactions_count || a.positive_reactions_count || 0,
        commentsCount: a.comments_count || 0,
        language: null,
        // dev.to's API is inconsistent across endpoints: tag_list is an array on
        // /articles but a comma-joined STRING on the search feed. Both shapes.
        topics: Array.isArray(a.tag_list)
          ? a.tag_list.slice(0, 6)
          : typeof a.tag_list === "string" && a.tag_list
            ? a.tag_list.split(/,\s*/).slice(0, 6)
            : [],
        author: {
          name: a.user?.name || a.user?.username || "unknown",
          avatar: a.user?.profile_image_90 || a.user?.profile_image || "",
        },
        updatedAt: a.published_at || a.created_at || "",
        upvotes: a.public_reactions_count || a.positive_reactions_count || 0,
        comments: a.comments_count || 0,
        createdAt: a.created_at || a.published_at,
      })),
      totalCount: items.length,
      source: "devto",
    };
  } catch (error) {
    console.error("Dev.to search error:", error);
    return { projects: [], totalCount: 0, source: "devto" };
  }
}
