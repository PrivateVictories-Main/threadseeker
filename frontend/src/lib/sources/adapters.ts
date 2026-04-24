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

// --- Shared transport helpers ---

// For hosts whose CORS is missing or inconsistent. The Pages Function adds
// a host allowlist and edge caching on top.
async function fetchViaProxy(targetUrl: string): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";
  const proxied = `${base}/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  return fetch(proxied);
}

// For sources backed by a dedicated Pages Function (e.g. /api/search-arxiv).
async function callBackend<T>(path: string, body: unknown): Promise<T | null> {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";
  if (base === "disabled") return null;
  try {
    const res = await fetch(`${base}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

// --- Repo hosts ---

export async function searchGitHub(
  query: string,
  page: number = 1,
  deepSearch: boolean = true,
): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenIds = new Set<number>();

  const searchStrategies = deepSearch
    ? [`${query} in:name,description,topics`, query]
    : [query];

  // Two parallel queries stay well under the 10 rpm unauthenticated limit.
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
        const response = await fetch(
          `https://api.github.com/search/repositories?${params}`,
          { headers: { Accept: "application/vnd.github.v3+json" } },
        );
        if (!response.ok) {
          if (response.status === 403) console.warn("GitHub rate limit reached");
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
        name: item.owner.login,
        avatar: item.owner.avatar_url || `https://github.com/${item.owner.login}.png?size=96`,
      },
      updatedAt: item.updated_at,
      license: item.license?.name || item.license?.spdx_id,
      homepage: item.homepage || undefined,
    })),
    totalCount: allResults.length,
    source: "github",
  };
}

export async function searchGitLab(
  query: string,
  page: number = 1,
  _deepSearch: boolean = true,
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
    })),
    totalCount: allResults.length,
    source: "gitlab",
  };
}

export async function searchCodeberg(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://codeberg.org/api/v1/repos/search?q=${encodeURIComponent(query)}&limit=40&sort=stars&order=desc`,
      { headers: { Accept: "application/json" } },
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
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok) return [];
        return (await r.json()) as any[];
      } catch (error) {
        console.error(`Hugging Face search error (${url}):`, error);
        return [];
      }
    }),
  );
  for (const items of responses) {
    for (const item of items) {
      if (item && !seenIds.has(item.id)) {
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
      updatedAt: item.lastModified || new Date().toISOString(),
      license: item.license,
    })),
    totalCount: allItems.length,
    source: "huggingface",
  };
}

export async function searchArxiv(query: string): Promise<SearchResult> {
  const data = await callBackend<{ results: any[] }>("/search-arxiv", { query });
  if (!data) return { projects: [], totalCount: 0, source: "arxiv" };
  const results = data.results || [];
  return {
    projects: results.map((p: any) => ({
      id: `arxiv-${p.id}`,
      source: "arxiv" as const,
      name: p.title,
      fullName: p.id.replace(/^https?:\/\/arxiv\.org\/abs\//, "arXiv:"),
      description: p.summary || null,
      url: p.url,
      stars: 0,
      language: null,
      topics: p.categories || [],
      author: {
        name: Array.isArray(p.authors) && p.authors.length ? p.authors[0] : "unknown",
        avatar: "",
      },
      updatedAt: p.published || p.updated || new Date().toISOString(),
    })),
    totalCount: results.length,
    source: "arxiv",
  };
}

export async function searchPapersWithCode(query: string): Promise<SearchResult> {
  try {
    const response = await fetchViaProxy(
      `https://paperswithcode.com/api/v1/papers/?q=${encodeURIComponent(query)}`,
    );
    if (!response.ok)
      return { projects: [], totalCount: 0, source: "paperswithcode" };
    const data = await response.json();
    const results = data.results || [];
    return {
      projects: results.slice(0, 30).map((p: any) => ({
        id: `pwc-${p.id}`,
        source: "paperswithcode" as const,
        name: p.title,
        fullName: p.id,
        description: p.abstract ? String(p.abstract).slice(0, 300) : null,
        url: p.url_abs || p.url_pdf || `https://paperswithcode.com/paper/${p.id}`,
        stars: 0,
        language: null,
        topics: [],
        author: {
          name: (Array.isArray(p.authors) ? p.authors[0] : p.authors) || "unknown",
          avatar: "",
        },
        updatedAt: p.published || new Date().toISOString(),
      })),
      totalCount: results.length,
      source: "paperswithcode",
    };
  } catch (error) {
    console.error("Papers with Code search error:", error);
    return { projects: [], totalCount: 0, source: "paperswithcode" };
  }
}

// --- Language package registries ---

export async function searchNpm(
  query: string,
  _deepSearch: boolean = true,
): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenNames = new Set<string>();

  try {
    const response = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=50`,
      { headers: { Accept: "application/json" } },
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
      stars: item.score.detail.quality * 1000,
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
    })),
    totalCount: allResults.length,
    source: "npm",
  };
}

// PyPI has no public search API. We hit the per-project JSON endpoint with
// the exact name plus a handful of common variants.
export async function searchPyPI(
  query: string,
  deepSearch: boolean = true,
): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenNames = new Set<string>();

  const terms = [query];
  if (deepSearch) {
    const q = query.toLowerCase().replace(/\s+/g, "-");
    terms.push(`python-${q}`, `${q}-python`, `py${q.replace(/-/g, "")}`);
  }

  const fetches = terms.map(async (term) => {
    try {
      const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(term)}/json`);
      if (res.ok) return await res.json();
    } catch {}
    return null;
  });

  for (const data of await Promise.all(fetches)) {
    if (data && !seenNames.has(data.info.name)) {
      seenNames.add(data.info.name);
      allResults.push(data);
    }
  }

  return {
    projects: allResults.map((data) => ({
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
      updatedAt: new Date().toISOString(),
      license: data.info.license,
      version: data.info.version,
      homepage: data.info.home_page || undefined,
    })),
    totalCount: allResults.length,
    source: "pypi",
  };
}

export async function searchCrates(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=50&sort=relevance`,
      { headers: { Accept: "application/json" } },
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
        updatedAt: c.updated_at || new Date().toISOString(),
        license: c.license,
        version: c.max_stable_version || c.newest_version,
        homepage: c.homepage || c.documentation || c.repository,
      })),
      totalCount: crates.length,
      source: "crates",
    };
  } catch (error) {
    console.error("crates.io search error:", error);
    return { projects: [], totalCount: 0, source: "crates" };
  }
}

export async function searchPackagist(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://packagist.org/search.json?q=${encodeURIComponent(query)}&per_page=40`,
      { headers: { Accept: "application/json" } },
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
        updatedAt: new Date().toISOString(),
      })),
      totalCount: results.length,
      source: "packagist",
    };
  } catch (error) {
    console.error("Packagist search error:", error);
    return { projects: [], totalCount: 0, source: "packagist" };
  }
}

export async function searchRubyGems(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } },
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
        updatedAt: g.version_created_at || new Date().toISOString(),
        license: Array.isArray(g.licenses) ? g.licenses.join(", ") : g.licenses,
        version: g.version,
        homepage: g.homepage_uri || g.source_code_uri,
      })),
      totalCount: Array.isArray(gems) ? gems.length : 0,
      source: "rubygems",
    };
  } catch (error) {
    console.error("RubyGems search error:", error);
    return { projects: [], totalCount: 0, source: "rubygems" };
  }
}

export async function searchJSR(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://api.jsr.io/packages?query=${encodeURIComponent(query)}&limit=30`,
      { headers: { Accept: "application/json" } },
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
          stars: p.score ?? 0,
          downloads: 0,
          language: "TypeScript",
          topics: [],
          author: { name: `@${p.scope}`, avatar: "" },
          updatedAt: p.updatedAt || p.latestVersion?.publishedAt || new Date().toISOString(),
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

export async function searchDockerHub(query: string): Promise<SearchResult> {
  try {
    const response = await fetchViaProxy(
      `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(query)}&page_size=30`,
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
        return {
          id: `dockerhub-${repoName}`,
          source: "dockerhub" as const,
          name,
          fullName: repoName,
          description: r.short_description || null,
          url: `https://hub.docker.com/r/${owner === "library" ? "_" : owner}/${name}`,
          stars: r.star_count || 0,
          downloads: r.pull_count || 0,
          language: null,
          topics: [],
          author: { name: owner, avatar: "" },
          updatedAt: r.last_updated || new Date().toISOString(),
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

export async function searchFlathub(query: string): Promise<SearchResult> {
  try {
    const response = await fetchViaProxy(
      `https://flathub.org/api/v2/search?query=${encodeURIComponent(query)}`,
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
        topics: a.categories || [],
        author: {
          name: a.developer_name || "Flathub",
          avatar: a.icon || "",
        },
        updatedAt: a.updated_at || new Date().toISOString(),
      })),
      totalCount: hits.length,
      source: "flathub",
    };
  } catch (error) {
    console.error("Flathub search error:", error);
    return { projects: [], totalCount: 0, source: "flathub" };
  }
}

export async function searchHomebrew(query: string): Promise<SearchResult> {
  const data = await callBackend<{ results: any[] }>("/search-homebrew", { query });
  if (!data) return { projects: [], totalCount: 0, source: "homebrew" };
  const results = data.results || [];
  return {
    projects: results.map((p: any) => {
      // Backend's `version` is the formula's `versions.stable` or the cask's
      // top-level `version`. Surfacing it as `project.version` lights up the
      // header version chip with parity to npm/pypi/crates/etc.
      // The legacy `updated` field is *not* a timestamp — it mirrors
      // `version` for back-compat but isn't usable as `updatedAt`. Until
      // brew.sh exposes a real updated-at we leave updatedAt as "now"
      // so the maintenance pill doesn't regress; it would otherwise
      // misread the version string as a date.
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
        updatedAt: new Date().toISOString(),
        version,
      };
    }),
    totalCount: results.length,
    source: "homebrew",
  };
}

export async function searchFDroid(query: string): Promise<SearchResult> {
  const data = await callBackend<{ results: any[] }>("/search-fdroid", { query });
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
      updatedAt: a.updated || new Date().toISOString(),
      license: a.license ?? undefined,
    })),
    totalCount: results.length,
    source: "fdroid",
  };
}

export async function searchAUR(query: string): Promise<SearchResult> {
  try {
    const url = `https://aur.archlinux.org/rpc/?v=5&type=search&by=name-desc&arg=${encodeURIComponent(query)}`;
    const response = await fetchViaProxy(url);
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
        updatedAt: p.LastModified
          ? new Date(p.LastModified * 1000).toISOString()
          : new Date().toISOString(),
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

export async function searchOpenVsx(query: string): Promise<SearchResult> {
  try {
    const url = `https://open-vsx.org/api/-/search?query=${encodeURIComponent(query)}&size=25&sortBy=relevance&sortOrder=desc`;
    const res = await fetch(url);
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
        updatedAt: ext.timestamp || new Date().toISOString(),
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

export async function searchCondaForge(query: string): Promise<SearchResult> {
  try {
    const url = `https://api.anaconda.org/search?name=${encodeURIComponent(query)}`;
    const response = await fetchViaProxy(url);
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
        updatedAt: p.latest_version_timestamp || new Date().toISOString(),
      })),
      totalCount: filtered.length,
      source: "conda",
    };
  } catch (error) {
    console.error("conda-forge search error:", error);
    return { projects: [], totalCount: 0, source: "conda" };
  }
}

export async function searchNuGet(query: string): Promise<SearchResult> {
  try {
    const url = `https://azuresearch-usnc.nuget.org/query?q=${encodeURIComponent(query)}&take=30&prerelease=false`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
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
        updatedAt: p.lastUpdated || new Date().toISOString(),
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

export async function searchZenodo(query: string): Promise<SearchResult> {
  try {
    // Prefer "software" records — the ones most likely to interest an
    // open-source searcher. Fall back to datasets if software returns
    // nothing. Publications (papers) already covered by arXiv.
    const url = `https://zenodo.org/api/records?q=${encodeURIComponent(query)}&size=25&sort=mostrecent&type=software,dataset`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return { projects: [], totalCount: 0, source: "zenodo" };
    const data = await response.json();
    const hits: any[] = data.hits?.hits || [];
    return {
      projects: hits.map((r: any) => {
        const m = r.metadata || {};
        const creators: any[] = m.creators || [];
        return {
          id: `zenodo-${r.id}`,
          source: "zenodo" as const,
          name: m.title || `Zenodo record ${r.id}`,
          fullName: r.doi || `zenodo:${r.id}`,
          description: m.description ? stripHtml(String(m.description)).slice(0, 300) : null,
          url: r.links?.self_html || r.doi_url || `https://zenodo.org/records/${r.id}`,
          stars: r.stats?.unique_views || 0,
          downloads: r.stats?.unique_downloads || r.stats?.downloads || 0,
          language: null,
          topics: (m.keywords || []).slice(0, 6),
          author: {
            name: creators[0]?.name || "unknown",
            avatar: "",
          },
          updatedAt: r.updated || r.created || m.publication_date || new Date().toISOString(),
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

export async function searchMaven(query: string): Promise<SearchResult> {
  try {
    // Maven Central's Solr endpoint. `rows=30` matches our other registry
    // adapters; `wt=json` is required (the default is XML). Response shape:
    //   response.docs[] with { id, g, a, latestVersion, p, timestamp, versionCount }
    const url = `https://search.maven.org/solrsearch/select?q=${encodeURIComponent(query)}&rows=30&wt=json`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
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
          downloads: p.versionCount || 0,
          language: "Java",
          topics: [],
          author: {
            name: p.g,
            avatar: "",
          },
          updatedAt: p.timestamp ? new Date(p.timestamp).toISOString() : new Date().toISOString(),
          version: p.latestVersion,
        };
      }),
      totalCount: data.response?.numFound || docs.length,
      source: "maven",
    };
  } catch (error) {
    console.error("Maven Central search error:", error);
    return { projects: [], totalCount: 0, source: "maven" };
  }
}

export async function searchWordPress(query: string): Promise<SearchResult> {
  try {
    // api.wordpress.org ignores browser CORS, so proxy it. Edge-cache via
    // the proxy keeps common queries cheap.
    const target = `https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&request%5Bsearch%5D=${encodeURIComponent(query)}&request%5Bper_page%5D=25`;
    const response = await fetchViaProxy(target);
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
        stars: Math.round((p.rating || 0) / 20), // convert 0-100 → 0-5
        downloads: p.active_installs || p.downloaded || 0,
        language: "PHP",
        topics: Object.keys(p.tags || {}).slice(0, 6),
        author: {
          name: stripHtml(decodeHtml(p.author || "")) || "unknown",
          avatar: p.icons?.["1x"] || p.icons?.default || "",
        },
        updatedAt: p.last_updated
          ? new Date(String(p.last_updated).replace(/\s+GMT$/, "Z").replace(" ", "T")).toISOString()
          : new Date().toISOString(),
      })),
      totalCount: plugins.length,
      source: "wordpress",
    };
  } catch (error) {
    console.error("WordPress plugins search error:", error);
    return { projects: [], totalCount: 0, source: "wordpress" };
  }
}

// --- Community threads ---

export async function searchHackerNews(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=40`,
      { headers: { Accept: "application/json" } },
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
        })),
      totalCount: hits.length,
      source: "hackernews",
    };
  } catch (error) {
    console.error("Hacker News search error:", error);
    return { projects: [], totalCount: 0, source: "hackernews" };
  }
}

export async function searchReddit(query: string): Promise<SearchResult> {
  try {
    const projects = await searchRedditViaBackend(query);
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

export async function searchLobsters(query: string): Promise<SearchResult> {
  try {
    const response = await fetchViaProxy(
      `https://lobste.rs/search.json?q=${encodeURIComponent(query)}&what=stories&order=relevance`,
    );
    if (!response.ok) return { projects: [], totalCount: 0, source: "lobsters" };
    const data = await response.json();
    const stories = Array.isArray(data) ? data : data.stories || [];
    return {
      projects: stories.slice(0, 30).map((s: any) => ({
        id: `lobsters-${s.short_id || s.id}`,
        source: "lobsters" as const,
        name: s.title,
        fullName: `lobste.rs/${s.short_id || s.id}`,
        description: s.description || null,
        url: s.url || s.comments_url || `https://lobste.rs/s/${s.short_id}`,
        stars: s.score || 0,
        commentsCount: s.comment_count || 0,
        language: null,
        topics: s.tags || [],
        author: {
          name: s.submitter_user?.username || "unknown",
          avatar: s.submitter_user?.avatar_url || "",
        },
        updatedAt: s.created_at || new Date().toISOString(),
      })),
      totalCount: stories.length,
      source: "lobsters",
    };
  } catch (error) {
    console.error("Lobsters search error:", error);
    return { projects: [], totalCount: 0, source: "lobsters" };
  }
}

export async function searchStackOverflow(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=30&filter=withbody`,
      { headers: { Accept: "application/json" } },
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
        updatedAt: q.last_activity_date
          ? new Date(q.last_activity_date * 1000).toISOString()
          : new Date().toISOString(),
      })),
      totalCount: items.length,
      source: "stackoverflow",
    };
  } catch (error) {
    console.error("Stack Overflow search error:", error);
    return { projects: [], totalCount: 0, source: "stackoverflow" };
  }
}

export async function searchDevTo(query: string): Promise<SearchResult> {
  try {
    // Dev.to has no direct search endpoint — pivot on tag + top latest.
    const tag = query.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const response = await fetch(
      `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=30&top=7`,
      { headers: { Accept: "application/json" } },
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
        topics: a.tag_list || [],
        author: {
          name: a.user?.name || a.user?.username || "unknown",
          avatar: a.user?.profile_image_90 || a.user?.profile_image || "",
        },
        updatedAt: a.published_at || a.created_at || new Date().toISOString(),
      })),
      totalCount: items.length,
      source: "devto",
    };
  } catch (error) {
    console.error("Dev.to search error:", error);
    return { projects: [], totalCount: 0, source: "devto" };
  }
}
