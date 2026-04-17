// Multi-source search aggregator for ThreadSeeker
// Free open-source project discovery across 11+ platforms

import { searchRedditViaBackend } from "./api-client";

export type SourceType =
  | "github"
  | "huggingface"
  | "gitlab"
  | "npm"
  | "pypi"
  | "reddit"
  | "crates"
  | "hackernews"
  | "codeberg"
  | "packagist"
  | "rubygems"
  | "dockerhub"
  | "jsr"
  | "flathub"
  | "devto"
  | "lobsters"
  | "stackoverflow"
  | "paperswithcode"
  | "homebrew"
  | "fdroid"
  | "arxiv"
  | "aur"
  | "openvsx"
  | "conda";

export interface RelatedSource {
  source: SourceType;
  url: string;
  fullName: string;
  name: string;
}

export interface UnifiedProject {
  id: string;
  source: SourceType;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  stars: number;
  downloads?: number;
  language: string | null;
  topics: string[];
  author: {
    name: string;
    avatar: string;
  };
  updatedAt: string;
  readme?: string;
  license?: string;
  // Optional community/sentiment fields (Reddit, HN)
  sentiment?: "positive" | "mixed" | "negative" | "neutral";
  warning?: string;
  commentsCount?: number;
  // Same underlying project on other platforms (e.g. the npm package + the
  // GitHub repo + the PyPI binding). Populated by mergeRelatedProjects().
  relatedSources?: RelatedSource[];
}

export interface SearchResult {
  projects: UnifiedProject[];
  totalCount: number;
  source: SourceType;
}

// GitHub Search - Enhanced with intelligent deep search
export async function searchGitHub(query: string, page: number = 1, deepSearch: boolean = true): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenIds = new Set<number>();

  const searchStrategies = deepSearch
    ? [`${query} in:name,description,topics`, query]
    : [query];

  // Run strategies concurrently. GitHub's rate limit for unauthenticated
  // search is 10 requests/min — two parallel calls is well under.
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
      license: item.license?.name,
    })),
    totalCount: allResults.length,
    source: "github",
  };
}

// Hugging Face Search - Enhanced with deep search
export async function searchHuggingFace(query: string, page: number = 1, deepSearch: boolean = true): Promise<SearchResult> {
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

// GitLab Search - Enhanced with deep search
export async function searchGitLab(query: string, page: number = 1, deepSearch: boolean = true): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenIds = new Set<number>();

  // Primary search by stars
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

// npm Search - Enhanced with deep search
export async function searchNpm(query: string, deepSearch: boolean = true): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenNames = new Set<string>();

  // Primary search
  try {
    const response = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=50`,
      { headers: { Accept: "application/json" } }
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
    })),
    totalCount: allResults.length,
    source: "npm",
  };
}

// PyPI Search — no free search API exists, so we try exact name + common variations
export async function searchPyPI(query: string, deepSearch: boolean = true): Promise<SearchResult> {
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
      url: data.info.project_url || data.info.home_page || `https://pypi.org/project/${data.info.name}`,
      stars: 0,
      downloads: 0,
      language: "Python",
      topics: data.info.keywords?.split(",").map((k: string) => k.trim()).filter(Boolean) || [],
      author: {
        name: data.info.author || "Unknown",
        avatar: "",
      },
      updatedAt: new Date().toISOString(),
      license: data.info.license,
    })),
    totalCount: allResults.length,
    source: "pypi",
  };
}

// crates.io (Rust packages) — free public API with CORS
export async function searchCrates(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=50&sort=relevance`,
      { headers: { Accept: "application/json" } }
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
      })),
      totalCount: crates.length,
      source: "crates",
    };
  } catch (error) {
    console.error("crates.io search error:", error);
    return { projects: [], totalCount: 0, source: "crates" };
  }
}

// Hacker News via Algolia — community discussion, free public API with CORS
export async function searchHackerNews(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=40`,
      { headers: { Accept: "application/json" } }
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

// Codeberg (Gitea-based FOSS git hosting) — free public API with CORS
export async function searchCodeberg(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://codeberg.org/api/v1/repos/search?q=${encodeURIComponent(query)}&limit=40&sort=stars&order=desc`,
      { headers: { Accept: "application/json" } }
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

// Packagist (PHP / Composer packages) — free public API with CORS
export async function searchPackagist(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://packagist.org/search.json?q=${encodeURIComponent(query)}&per_page=40`,
      { headers: { Accept: "application/json" } }
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

// RubyGems — free public API with CORS
export async function searchRubyGems(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } }
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
      })),
      totalCount: Array.isArray(gems) ? gems.length : 0,
      source: "rubygems",
    };
  } catch (error) {
    console.error("RubyGems search error:", error);
    return { projects: [], totalCount: 0, source: "rubygems" };
  }
}

// Helper: fetch through our Pages Function proxy for sources with no/bad CORS.
// The proxy adds edge caching and a host allowlist on the server side.
async function fetchViaProxy(targetUrl: string): Promise<Response> {
  const base =
    process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";
  const proxied = `${base}/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  return fetch(proxied);
}

// Docker Hub — container images. No CORS, so we go through the proxy.
export async function searchDockerHub(query: string): Promise<SearchResult> {
  try {
    const response = await fetchViaProxy(
      `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(query)}&page_size=30`,
    );
    if (!response.ok)
      return { projects: [], totalCount: 0, source: "dockerhub" };
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

// JSR — modern JavaScript/TypeScript registry (Deno). Free CORS API.
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

// Flathub — Linux desktop FOSS apps. Proxied because CORS is inconsistent.
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

// Dev.to — developer articles & tutorials. Free CORS API.
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

// Lobste.rs — higher-signal HN-style threads. Proxied (CORS varies).
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

// Stack Overflow — via StackExchange API. Free, CORS-friendly.
export async function searchStackOverflow(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=30&filter=withbody`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok)
      return { projects: [], totalCount: 0, source: "stackoverflow" };
    const data = await response.json();
    const items = data.items || [];
    return {
      projects: items.map((q: any) => ({
        id: `stackoverflow-${q.question_id}`,
        source: "stackoverflow" as const,
        name: decodeHtml(q.title || ""),
        fullName: `SO: ${decodeHtml(q.title || "")}`,
        description: q.body
          ? stripHtml(q.body).slice(0, 280)
          : null,
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

// Papers with Code — ML papers + implementations. Proxied (inconsistent CORS).
export async function searchPapersWithCode(
  query: string,
): Promise<SearchResult> {
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
        description: p.abstract
          ? String(p.abstract).slice(0, 300)
          : null,
        url:
          p.url_abs ||
          p.url_pdf ||
          `https://paperswithcode.com/paper/${p.id}`,
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

// Pages Function call helper for sources that need server-side indexing.
async function callBackend<T>(
  path: string,
  body: unknown,
): Promise<T | null> {
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

// Homebrew — macOS package manager. Index lives in a Pages Function because
// brew.sh has no search API; we fetch the full formula/cask list and filter.
export async function searchHomebrew(query: string): Promise<SearchResult> {
  const data = await callBackend<{ results: any[] }>("/search-homebrew", { query });
  if (!data) return { projects: [], totalCount: 0, source: "homebrew" };
  const results = data.results || [];
  return {
    projects: results.map((p: any) => ({
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
      updatedAt: p.updated || new Date().toISOString(),
    })),
    totalCount: results.length,
    source: "homebrew",
  };
}

// F-Droid — Android FOSS app store. Index fetched server-side.
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

// arXiv — scientific papers. Atom XML parsed server-side.
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

// AUR — Arch Linux User Repository. RPC returns JSON; proxied because the
// AUR endpoint's CORS headers are inconsistent across browsers.
export async function searchAUR(query: string): Promise<SearchResult> {
  try {
    const url = `https://aur.archlinux.org/rpc/?v=5&type=search&by=name-desc&arg=${encodeURIComponent(query)}`;
    const data = await fetchViaProxy<{ results: any[] }>(url);
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

// Open VSX — open-source VS Code extension marketplace (Eclipse Foundation).
// CORS-enabled public API, called directly from the browser.
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
        author: {
          name: ext.namespace || "unknown",
          avatar: ext.namespaceAccess === "public" ? "" : "",
        },
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

// conda-forge — anaconda.org public search. Returns packages from
// conda-forge, bioconda, and other channels.
export async function searchCondaForge(query: string): Promise<SearchResult> {
  try {
    const url = `https://api.anaconda.org/search?name=${encodeURIComponent(query)}`;
    const data = await fetchViaProxy<any[]>(url);
    if (!Array.isArray(data)) return { projects: [], totalCount: 0, source: "conda" };
    // Filter to conda-forge channel primarily, then the top 25.
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
        topics: [p.owner, ...(p.platforms || []).slice(0, 3)].filter(Boolean),
        author: { name: p.owner, avatar: "" },
        updatedAt: p.latest_upload_time
          ? new Date(p.latest_upload_time).toISOString()
          : new Date().toISOString(),
        license: p.license ?? undefined,
      })),
      totalCount: filtered.length,
      source: "conda",
    };
  } catch (error) {
    console.error("conda-forge search error:", error);
    return { projects: [], totalCount: 0, source: "conda" };
  }
}

// Reddit — CORS blocked client-side, proxied through our Pages Function
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

export interface SearchProgressEvent {
  source: SourceType;
  projects: UnifiedProject[];  // ranked slice for this source alone
  done: boolean;               // true once every source has completed
  remaining: number;           // sources still in flight after this event
}

export type SearchProgressCallback = (event: SearchProgressEvent) => void;

// Unified multi-source search. Each source fires `onProgress` the moment it
// resolves so the UI can render fast sources (GitHub, npm) without waiting
// on slow ones. The returned promise still resolves with every project,
// sorted by relevance against the original user query.
export async function searchAllSources(
  query: string,
  sources: SourceType[] = [
    "github",
    "huggingface",
    "gitlab",
    "npm",
    "pypi",
    "crates",
    "hackernews",
    "codeberg",
    "packagist",
    "rubygems",
    "reddit",
    "dockerhub",
    "jsr",
    "flathub",
    "devto",
    "lobsters",
    "stackoverflow",
    "paperswithcode",
    "homebrew",
    "fdroid",
    "arxiv",
    "aur",
    "openvsx",
    "conda",
  ],
  deepSearch: boolean = true,
  queryOverrides: Partial<Record<SourceType, string>> = {},
  onProgress?: SearchProgressCallback,
): Promise<UnifiedProject[]> {
  const q = (source: SourceType) => queryOverrides[source] || query;
  let remaining = sources.length;

  // Hard per-source timeout. If a source hasn't returned in 12 s it gets
  // ignored for this run — the rest of the UI continues. This protects
  // against one flaky upstream stalling the "remaining N sources" counter
  // indefinitely.
  const PER_SOURCE_TIMEOUT_MS = 12_000;
  const withTimeout = async <T>(
    label: SourceType,
    work: () => Promise<T>,
  ): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out`)),
        PER_SOURCE_TIMEOUT_MS,
      ),
    );
    return Promise.race([work(), timeout]);
  };

  const runSource = async (source: SourceType): Promise<SearchResult> => {
    switch (source) {
      case "github":
        return searchGitHub(q("github"), 1, deepSearch);
      case "huggingface":
        return searchHuggingFace(q("huggingface"), 1, deepSearch);
      case "gitlab":
        return searchGitLab(q("gitlab"), 1, deepSearch);
      case "npm":
        return searchNpm(q("npm"), deepSearch);
      case "pypi":
        return searchPyPI(q("pypi"), deepSearch);
      case "crates":
        return searchCrates(q("crates"));
      case "hackernews":
        return searchHackerNews(q("hackernews"));
      case "codeberg":
        return searchCodeberg(q("codeberg"));
      case "packagist":
        return searchPackagist(q("packagist"));
      case "rubygems":
        return searchRubyGems(q("rubygems"));
      case "reddit":
        return searchReddit(q("reddit"));
      case "dockerhub":
        return searchDockerHub(q("dockerhub"));
      case "jsr":
        return searchJSR(q("jsr"));
      case "flathub":
        return searchFlathub(q("flathub"));
      case "devto":
        return searchDevTo(q("devto"));
      case "lobsters":
        return searchLobsters(q("lobsters"));
      case "stackoverflow":
        return searchStackOverflow(q("stackoverflow"));
      case "paperswithcode":
        return searchPapersWithCode(q("paperswithcode"));
      case "homebrew":
        return searchHomebrew(q("homebrew"));
      case "fdroid":
        return searchFDroid(q("fdroid"));
      case "arxiv":
        return searchArxiv(q("arxiv"));
      case "aur":
        return searchAUR(q("aur"));
      case "openvsx":
        return searchOpenVsx(q("openvsx"));
      case "conda":
        return searchCondaForge(q("conda"));
      default:
        return { projects: [], totalCount: 0, source };
    }
  };

  const searchPromises = sources.map(async (source) => {
    let result: SearchResult;
    try {
      result = await withTimeout(source, () => runSource(source));
    } catch (error) {
      console.error(`Error searching ${source}:`, error);
      result = { projects: [], totalCount: 0, source };
    }

    remaining -= 1;
    if (onProgress) {
      // Sort this source's projects on their own so partial UI renders are
      // already usefully ordered before later sources arrive.
      const ranked = [...result.projects].sort(
        (a, b) =>
          calculateRelevanceScore(b, query) - calculateRelevanceScore(a, query),
      );
      onProgress({
        source,
        projects: ranked,
        done: remaining === 0,
        remaining,
      });
    }
    return result;
  });

  const results = await Promise.all(searchPromises);
  const allProjects = results.flatMap((r) => r.projects);

  // Rank against the original user query so all sources are compared on the same axis.
  return allProjects.sort((a, b) => {
    const scoreA = calculateRelevanceScore(a, query);
    const scoreB = calculateRelevanceScore(b, query);
    return scoreB - scoreA;
  });
}

function calculateRelevanceScore(project: UnifiedProject, query: string): number {
  const q = query.toLowerCase().trim();
  const qWords = q.split(/\s+/).filter((w) => w.length > 1);
  const name = project.name.toLowerCase();
  const nameTokens = name.split(/[-_\s.]+/).filter(Boolean);
  let s = 0;

  // --- Name match (dominant signal) ---
  if (name === q) s += 15_000;
  else if (name.replace(/[-_\s.]/g, "") === q.replace(/[-_\s.]/g, "")) s += 12_000;
  else if (name.startsWith(q)) s += 8_000;
  else if (nameTokens.includes(q)) s += 5_000;
  else if (name.includes(q)) s += 3_000;

  if (qWords.length > 1) {
    const hits = qWords.filter((w) => nameTokens.some((n) => n.includes(w) || w.includes(n)));
    if (hits.length === qWords.length) s += 4_000;
    s += hits.length * 1_000;
  }

  for (const w of qWords) {
    for (const n of nameTokens) {
      if (n === w) s += 1_200;
      else if (n.startsWith(w)) s += 800;
      else if (n.includes(w)) s += 400;
    }
  }

  // --- Full path ---
  const full = project.fullName.toLowerCase();
  if (full.includes(q)) s += 600;
  for (const w of qWords) if (full.includes(w)) s += 250;

  // --- Description ---
  if (project.description) {
    const d = project.description.toLowerCase();
    if (d.includes(q)) s += 800;
    if (qWords.length > 1 && qWords.every((w) => d.includes(w))) s += 600;
    for (const w of qWords) {
      const hits = (d.match(new RegExp(w, "g")) || []).length;
      s += Math.min(hits * 150, 600);
    }
  }

  // --- Topics ---
  const topics = project.topics.map((t) => t.toLowerCase());
  s += topics.filter((t) => t === q).length * 2_000;
  s += topics.filter((t) => t.includes(q)).length * 800;
  for (const w of qWords) s += topics.filter((t) => t.includes(w)).length * 500;

  // --- Language match ---
  if (project.language) {
    const lang = project.language.toLowerCase();
    if (q.includes(lang) || lang.includes(q)) s += 600;
  }

  // --- Popularity (log-scaled, capped) ---
  if (project.stars > 0) {
    s += Math.min(Math.log10(project.stars + 1) * 200, 2_000);
    if (project.stars > 10_000) s += 500;
    if (project.stars > 50_000) s += 500;
  }
  if (project.downloads && project.downloads > 0) {
    s += Math.min(Math.log10(project.downloads + 1) * 150, 1_500);
  }

  // --- Recency ---
  const ageDays = (Date.now() - new Date(project.updatedAt).getTime()) / 86_400_000;
  if (ageDays < 7) s += 500;
  else if (ageDays < 30) s += 300;
  else if (ageDays < 90) s += 150;
  else if (ageDays > 730) s -= 500;
  else if (ageDays > 365) s -= 200;

  // --- Source baseline ---
  const srcBonus: Record<SourceType, number> = {
    github: 150, huggingface: 140, npm: 120, pypi: 120, crates: 120,
    packagist: 110, rubygems: 110, gitlab: 100, codeberg: 100,
    dockerhub: 120, jsr: 110, flathub: 105,
    homebrew: 110, fdroid: 100, arxiv: 110,
    paperswithcode: 115, stackoverflow: 95,
    hackernews: 90, reddit: 90, lobsters: 90, devto: 85,
    aur: 100, openvsx: 110, conda: 115,
  };
  s += srcBonus[project.source] ?? 0;

  // --- Quality signals ---
  if (project.description && project.description.length > 50) s += 150;
  if (project.topics.length > 3) s += 100;

  // --- Trending: actively maintained AND popular ---
  // Strong signal that this is a live, maintained, well-known project —
  // exactly what most "find me a library for X" queries want.
  if (project.stars >= 1_000 && ageDays < 90) s += 800;
  if (project.stars >= 10_000 && ageDays < 180) s += 400;

  // --- Abandonment penalty ---
  // Dead repos with few stars clutter results. Don't penalize popular
  // classics (they may just be done), but punish the long tail.
  if (ageDays > 365 * 3 && project.stars < 500) s -= 400;

  // --- Zero-signal penalty ---
  // No stars, no downloads, no description — probably noise.
  const noStars = project.stars === 0;
  const noDownloads = !project.downloads || project.downloads === 0;
  const noDesc = !project.description || project.description.length < 20;
  if (noStars && noDownloads && noDesc) s -= 600;

  // --- All query terms present (whole-token) in name OR description ---
  // Much stronger signal than substring hits — means the project actually
  // is about what the user asked for.
  if (qWords.length >= 2) {
    const d = (project.description || "").toLowerCase();
    const haystack = new Set([...nameTokens, ...d.split(/[^a-z0-9]+/).filter(Boolean)]);
    const allHit = qWords.every((w) => haystack.has(w));
    if (allHit) s += 1_500;
  }

  // --- Intent token boosts ---
  // When the query mentions an ecosystem (e.g. "react", "python", "rust"),
  // strongly prefer projects whose language or source matches.
  const LANG_INTENT: Record<string, { lang?: string[]; sources?: SourceType[] }> = {
    python: { lang: ["python"], sources: ["pypi"] },
    py: { lang: ["python"], sources: ["pypi"] },
    javascript: { lang: ["javascript", "typescript"], sources: ["npm", "jsr"] },
    js: { lang: ["javascript", "typescript"], sources: ["npm", "jsr"] },
    typescript: { lang: ["typescript"], sources: ["npm", "jsr"] },
    ts: { lang: ["typescript"], sources: ["npm", "jsr"] },
    rust: { lang: ["rust"], sources: ["crates"] },
    go: { lang: ["go"] },
    golang: { lang: ["go"] },
    ruby: { lang: ["ruby"], sources: ["rubygems"] },
    php: { lang: ["php"], sources: ["packagist"] },
    react: { lang: ["javascript", "typescript"] },
    vue: { lang: ["javascript", "typescript"] },
    svelte: { lang: ["javascript", "typescript"] },
  };
  for (const w of qWords) {
    const intent = LANG_INTENT[w];
    if (!intent) continue;
    if (project.language && intent.lang?.some((l) => project.language!.toLowerCase() === l)) {
      s += 600;
    }
    if (intent.sources?.includes(project.source)) s += 300;
  }

  return Math.max(0, s);
}

// Return the source's native search URL for a query, so the UI can offer
// a "see all on X" escape hatch when the user wants more than what
// ThreadSeeker returned. Returns null if the source has no public search UI.
export function getSourceSearchUrl(source: SourceType, query: string): string | null {
  const q = encodeURIComponent(query);
  switch (source) {
    case "github":
      return `https://github.com/search?q=${q}&type=repositories`;
    case "gitlab":
      return `https://gitlab.com/search?search=${q}`;
    case "codeberg":
      return `https://codeberg.org/explore/repos?q=${q}`;
    case "npm":
      return `https://www.npmjs.com/search?q=${q}`;
    case "pypi":
      return `https://pypi.org/search/?q=${q}`;
    case "crates":
      return `https://crates.io/search?q=${q}`;
    case "packagist":
      return `https://packagist.org/?query=${q}`;
    case "rubygems":
      return `https://rubygems.org/search?query=${q}`;
    case "jsr":
      return `https://jsr.io/packages?search=${q}`;
    case "huggingface":
      return `https://huggingface.co/search/full-text?q=${q}`;
    case "hackernews":
      return `https://hn.algolia.com/?q=${q}`;
    case "reddit":
      return `https://www.reddit.com/search/?q=${q}`;
    case "lobsters":
      return `https://lobste.rs/search?q=${q}&what=stories&order=relevance`;
    case "stackoverflow":
      return `https://stackoverflow.com/search?q=${q}`;
    case "devto":
      return `https://dev.to/search?q=${q}`;
    case "dockerhub":
      return `https://hub.docker.com/search?q=${q}`;
    case "flathub":
      return `https://flathub.org/apps/search?q=${q}`;
    case "homebrew":
      return `https://formulae.brew.sh/formula-search/?q=${q}`;
    case "fdroid":
      return `https://search.f-droid.org/?q=${q}`;
    case "aur":
      return `https://aur.archlinux.org/packages?K=${q}`;
    case "openvsx":
      return `https://open-vsx.org/?query=${q}`;
    case "conda":
      return `https://anaconda.org/search?q=${q}`;
    case "paperswithcode":
      return `https://paperswithcode.com/search?q=${q}`;
    case "arxiv":
      return `https://arxiv.org/search/?query=${q}&searchtype=all`;
    default:
      return null;
  }
}

export function getSourceConfig(source: SourceType) {
  const configs: Record<
    SourceType,
    {
      name: string;
      icon: string;
      color: string;
      borderColor: string;
      bgColor: string;
    }
  > = {
    github: {
      name: "GitHub",
      icon: "🐙",
      color: "from-gray-500 to-gray-700",
      borderColor: "border-gray-500/30",
      bgColor: "bg-gray-500/10",
    },
    huggingface: {
      name: "Hugging Face",
      icon: "🤗",
      color: "from-yellow-500 to-orange-500",
      borderColor: "border-yellow-500/30",
      bgColor: "bg-yellow-500/10",
    },
    gitlab: {
      name: "GitLab",
      icon: "🦊",
      color: "from-orange-500 to-red-500",
      borderColor: "border-orange-500/30",
      bgColor: "bg-orange-500/10",
    },
    npm: {
      name: "npm",
      icon: "📦",
      color: "from-red-600 to-red-700",
      borderColor: "border-red-500/30",
      bgColor: "bg-red-500/10",
    },
    pypi: {
      name: "PyPI",
      icon: "🐍",
      color: "from-blue-500 to-cyan-500",
      borderColor: "border-blue-500/30",
      bgColor: "bg-blue-500/10",
    },
    crates: {
      name: "crates.io",
      icon: "🦀",
      color: "from-orange-600 to-amber-700",
      borderColor: "border-orange-500/30",
      bgColor: "bg-orange-500/10",
    },
    hackernews: {
      name: "Hacker News",
      icon: "💬",
      color: "from-orange-400 to-amber-500",
      borderColor: "border-amber-500/30",
      bgColor: "bg-amber-500/10",
    },
    codeberg: {
      name: "Codeberg",
      icon: "🌲",
      color: "from-emerald-500 to-teal-600",
      borderColor: "border-emerald-500/30",
      bgColor: "bg-emerald-500/10",
    },
    packagist: {
      name: "Packagist",
      icon: "🐘",
      color: "from-indigo-500 to-purple-600",
      borderColor: "border-indigo-500/30",
      bgColor: "bg-indigo-500/10",
    },
    rubygems: {
      name: "RubyGems",
      icon: "💎",
      color: "from-red-500 to-pink-600",
      borderColor: "border-rose-500/30",
      bgColor: "bg-rose-500/10",
    },
    reddit: {
      name: "Reddit",
      icon: "👾",
      color: "from-orange-500 to-red-500",
      borderColor: "border-orange-500/30",
      bgColor: "bg-orange-500/10",
    },
    dockerhub: {
      name: "Docker Hub",
      icon: "🐳",
      color: "from-sky-500 to-blue-600",
      borderColor: "border-sky-500/30",
      bgColor: "bg-sky-500/10",
    },
    jsr: {
      name: "JSR",
      icon: "🦕",
      color: "from-yellow-400 to-amber-500",
      borderColor: "border-yellow-500/30",
      bgColor: "bg-yellow-500/10",
    },
    flathub: {
      name: "Flathub",
      icon: "📦",
      color: "from-sky-600 to-indigo-600",
      borderColor: "border-indigo-500/30",
      bgColor: "bg-indigo-500/10",
    },
    devto: {
      name: "Dev.to",
      icon: "✍️",
      color: "from-zinc-400 to-zinc-600",
      borderColor: "border-zinc-500/30",
      bgColor: "bg-zinc-500/10",
    },
    lobsters: {
      name: "Lobsters",
      icon: "🦞",
      color: "from-rose-400 to-red-500",
      borderColor: "border-rose-500/30",
      bgColor: "bg-rose-500/10",
    },
    stackoverflow: {
      name: "Stack Overflow",
      icon: "📚",
      color: "from-orange-400 to-amber-500",
      borderColor: "border-orange-500/30",
      bgColor: "bg-orange-500/10",
    },
    paperswithcode: {
      name: "Papers with Code",
      icon: "📄",
      color: "from-violet-500 to-fuchsia-500",
      borderColor: "border-violet-500/30",
      bgColor: "bg-violet-500/10",
    },
    homebrew: {
      name: "Homebrew",
      icon: "🍺",
      color: "from-amber-500 to-yellow-600",
      borderColor: "border-amber-500/30",
      bgColor: "bg-amber-500/10",
    },
    fdroid: {
      name: "F-Droid",
      icon: "🤖",
      color: "from-lime-500 to-green-600",
      borderColor: "border-lime-500/30",
      bgColor: "bg-lime-500/10",
    },
    arxiv: {
      name: "arXiv",
      icon: "📜",
      color: "from-red-500 to-rose-600",
      borderColor: "border-red-500/30",
      bgColor: "bg-red-500/10",
    },
    aur: {
      name: "AUR",
      icon: "🏛️",
      color: "from-sky-500 to-blue-600",
      borderColor: "border-sky-500/30",
      bgColor: "bg-sky-500/10",
    },
    openvsx: {
      name: "Open VSX",
      icon: "🧩",
      color: "from-violet-500 to-purple-600",
      borderColor: "border-violet-500/30",
      bgColor: "bg-violet-500/10",
    },
    conda: {
      name: "conda-forge",
      icon: "🥬",
      color: "from-green-500 to-emerald-600",
      borderColor: "border-green-500/30",
      bgColor: "bg-green-500/10",
    },
  };
  return configs[source];
}

// Thread-like sources are kept separate from dedup — a Reddit thread about
// `next.js` is not the same thing as the npm package. Dedup only folds
// project-shaped sources (repos + registries + image/app stores) together.
const DEDUPABLE_SOURCES: ReadonlySet<SourceType> = new Set<SourceType>([
  "github",
  "gitlab",
  "codeberg",
  "huggingface",
  "npm",
  "pypi",
  "crates",
  "packagist",
  "rubygems",
  "jsr",
  "dockerhub",
  "flathub",
  "homebrew",
  "fdroid",
  "aur",
  "openvsx",
  "conda",
]);

// Normalize a project's name/identifier for comparison: strip scopes, cases,
// separators, and common noise words so `@react/next-auth`, `next-auth`, and
// `nextauth` collapse to the same fingerprint.
function projectFingerprint(p: UnifiedProject): string {
  let s = p.name.toLowerCase();
  // Strip npm-style scope: @scope/name → name
  s = s.replace(/^@[^/]+\//, "");
  // Strip common prefixes/suffixes
  s = s.replace(/^(python-|py-|node-|rust-|ruby-|go-)/, "");
  s = s.replace(/(-python|-py|-node|-rust|-ruby|-go|-official)$/, "");
  // Collapse all separators
  s = s.replace(/[-_.\s]+/g, "");
  return s;
}

// Merge projects that represent the same underlying thing across platforms.
// E.g. the `fastapi` GitHub repo + the `fastapi` PyPI package + the `fastapi`
// Docker image all fold into one card, with secondary platforms shown as
// badges and their install commands still reachable.
//
// The primary is chosen by:
//   1. Repo sources (github > gitlab > codeberg) when present
//   2. Otherwise the source with the highest relevance baseline
export function mergeRelatedProjects(
  projects: UnifiedProject[],
): UnifiedProject[] {
  // Group by fingerprint (only for dedupable sources — threads pass through).
  const groups = new Map<string, UnifiedProject[]>();
  const standalone: UnifiedProject[] = [];

  for (const p of projects) {
    if (!DEDUPABLE_SOURCES.has(p.source)) {
      standalone.push(p);
      continue;
    }
    const fp = projectFingerprint(p);
    if (!fp) {
      standalone.push(p);
      continue;
    }
    // Only merge if descriptions share at least one substantive word OR
    // names match exactly. Guards against `react` the repo colliding with
    // `react` the PyPI package that's totally unrelated.
    const bucket = groups.get(fp);
    if (bucket) bucket.push(p);
    else groups.set(fp, [p]);
  }

  const repoRank: Record<string, number> = {
    github: 3,
    gitlab: 2,
    codeberg: 1,
  };

  const merged: UnifiedProject[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      merged.push(bucket[0]);
      continue;
    }

    // Further split by description affinity: projects in the same
    // fingerprint bucket must share a description word ≥4 chars OR one of
    // them must be a GitHub repo (the GitHub repo is usually canonical).
    const subgroups = splitByAffinity(bucket);
    for (const sub of subgroups) {
      if (sub.length === 1) {
        merged.push(sub[0]);
        continue;
      }
      // Pick primary: prefer the highest-ranked repo host; else the item
      // with the most stars/downloads.
      const primary = [...sub].sort((a, b) => {
        const ra = repoRank[a.source] ?? 0;
        const rb = repoRank[b.source] ?? 0;
        if (ra !== rb) return rb - ra;
        return (b.stars || b.downloads || 0) - (a.stars || a.downloads || 0);
      })[0];

      const related: RelatedSource[] = sub
        .filter((p) => p.id !== primary.id)
        .map((p) => ({
          source: p.source,
          url: p.url,
          fullName: p.fullName,
          name: p.name,
        }));

      merged.push({ ...primary, relatedSources: related });
    }
  }

  return [...merged, ...standalone];
}

function splitByAffinity(group: UnifiedProject[]): UnifiedProject[][] {
  // If there's a GitHub/GitLab/Codeberg in the group, treat it as the
  // anchor and fold everything into one subgroup. Otherwise require each
  // pair to share a description word.
  const hasRepo = group.some((p) =>
    ["github", "gitlab", "codeberg"].includes(p.source),
  );
  if (hasRepo) return [group];

  const word = (s: string | null) =>
    new Set(
      (s || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4),
    );

  const used = new Set<string>();
  const out: UnifiedProject[][] = [];
  for (const p of group) {
    if (used.has(p.id)) continue;
    used.add(p.id);
    const sub = [p];
    const words = word(p.description);
    for (const q of group) {
      if (used.has(q.id)) continue;
      const qWords = word(q.description);
      const overlap = [...words].some((w) => qWords.has(w));
      if (overlap || (!p.description && !q.description)) {
        used.add(q.id);
        sub.push(q);
      }
    }
    out.push(sub);
  }
  return out;
}

