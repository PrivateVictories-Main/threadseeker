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
  | "rubygems";

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

  // Build comprehensive search query with multiple strategies
  // Use deep search only for user queries, not trending (to avoid rate limits)
  const searchStrategies = deepSearch 
    ? [
        `${query} in:name,description,topics`, // Search in key fields (most comprehensive)
        query, // Exact query
      ]
    : [query]; // Single query for trending

  // Execute search strategies sequentially to avoid rate limits
  for (const searchQuery of searchStrategies) {
    const params = new URLSearchParams({
      q: searchQuery,
      sort: "stars",
      order: "desc",
      page: page.toString(),
      per_page: "50", // Increased to get more results per request
    });

    try {
      const response = await fetch(`https://api.github.com/search/repositories?${params}`, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });

      if (!response.ok) {
        if (response.status === 403) {
          console.warn("GitHub rate limit reached");
          break; // Stop if we hit rate limit
        }
        continue;
      }

      const data = await response.json();
      const items = data.items || [];
      
      // Add unique items
      items.forEach((item: any) => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allResults.push(item);
        }
      });

      // Small delay between requests to avoid rate limiting
      if (deepSearch && searchStrategies.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`GitHub search error for "${searchQuery}":`, error);
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

  // Primary search: Models sorted by downloads (most relevant)
  try {
    const modelsResponse = await fetch(
      `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=50`,
      { headers: { Accept: "application/json" } }
    );
    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
      models.forEach((item: any) => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allItems.push(item);
        }
      });
    }
  } catch (error) {
    console.error("Hugging Face models search error:", error);
  }

  // Deep search: Also get datasets if enabled
  if (deepSearch) {
    try {
      const datasetsResponse = await fetch(
        `https://huggingface.co/api/datasets?search=${encodeURIComponent(query)}&sort=downloads&direction=-1&limit=20`,
        { headers: { Accept: "application/json" } }
      );
      if (datasetsResponse.ok) {
        const datasets = await datasetsResponse.json();
        datasets.forEach((item: any) => {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            allItems.push(item);
          }
        });
      }
    } catch (error) {
      console.error("Hugging Face datasets search error:", error);
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

// PyPI Search - Enhanced with deep search using multiple APIs
export async function searchPyPI(query: string, deepSearch: boolean = true): Promise<SearchResult> {
  const allResults: any[] = [];
  const seenNames = new Set<string>();
  
  // Strategy 1: Try exact package match
  try {
    const exactResponse = await fetch(
      `https://pypi.org/pypi/${encodeURIComponent(query)}/json`
    );
    if (exactResponse.ok) {
      const data = await exactResponse.json();
      seenNames.add(data.info.name);
      allResults.push(data);
    }
  } catch {}

  // Strategy 2: Search common variations (only if deep search)
  if (deepSearch && allResults.length < 10) {
    const searchTerms = [
      `${query}-python`,
      `python-${query}`,
      `py${query}`,
    ];

    for (const term of searchTerms) {
      try {
        const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(term)}/json`);
        if (response.ok) {
          const data = await response.json();
          if (!seenNames.has(data.info.name)) {
            seenNames.add(data.info.name);
            allResults.push(data);
          }
        }
      } catch {}
    }
  }

  // Strategy 3: Search popular related packages (only if still not enough results)
  if (deepSearch && allResults.length < 5) {
    const popularPyPIPackages = [
      'django', 'flask', 'fastapi', 'requests', 'numpy', 'pandas', 
      'tensorflow', 'pytorch', 'scikit-learn', 'matplotlib', 'pytest',
      'sqlalchemy', 'celery', 'redis', 'pillow', 'beautifulsoup4'
    ];
    
    const relatedPackages = popularPyPIPackages.filter(pkg => 
      pkg.includes(query.toLowerCase()) || query.toLowerCase().includes(pkg)
    ).slice(0, 5);

    for (const pkg of relatedPackages) {
      try {
        const response = await fetch(`https://pypi.org/pypi/${pkg}/json`);
        if (response.ok) {
          const data = await response.json();
          if (!seenNames.has(data.info.name)) {
            seenNames.add(data.info.name);
            allResults.push(data);
          }
        }
      } catch {}
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

// Reddit — CORS blocked client-side, proxied through our Python backend
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

// Unified multi-source search
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
  ],
  deepSearch: boolean = true
): Promise<UnifiedProject[]> {
  const searchPromises = sources.map(async (source) => {
    try {
      switch (source) {
        case "github":
          return await searchGitHub(query, 1, deepSearch);
        case "huggingface":
          return await searchHuggingFace(query, 1, deepSearch);
        case "gitlab":
          return await searchGitLab(query, 1, deepSearch);
        case "npm":
          return await searchNpm(query, deepSearch);
        case "pypi":
          return await searchPyPI(query, deepSearch);
        case "crates":
          return await searchCrates(query);
        case "hackernews":
          return await searchHackerNews(query);
        case "codeberg":
          return await searchCodeberg(query);
        case "packagist":
          return await searchPackagist(query);
        case "rubygems":
          return await searchRubyGems(query);
        case "reddit":
          return await searchReddit(query);
        default:
          return { projects: [], totalCount: 0, source };
      }
    } catch (error) {
      console.error(`Error searching ${source}:`, error);
      return { projects: [], totalCount: 0, source };
    }
  });

  const results = await Promise.all(searchPromises);
  const allProjects = results.flatMap((r) => r.projects);

  // Smart ranking: prioritize by relevance score
  return allProjects.sort((a, b) => {
    const scoreA = calculateRelevanceScore(a, query);
    const scoreB = calculateRelevanceScore(b, query);
    return scoreB - scoreA;
  });
}

// Calculate relevance score for intelligent ranking (best first)
// This is a comprehensive scoring algorithm that considers multiple factors
function calculateRelevanceScore(project: UnifiedProject, query: string): number {
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);
  let score = 0;

  // === NAME MATCHING (Highest Priority) ===
  const nameLower = project.name.toLowerCase();
  const nameWords = nameLower.split(/[-_\s.]+/).filter(Boolean);
  
  // Perfect exact match
  if (nameLower === queryLower) {
    score += 15000;
  }
  // Exact match ignoring separators
  else if (nameLower.replace(/[-_\s.]/g, '') === queryLower.replace(/[-_\s.]/g, '')) {
    score += 12000;
  }
  // Name starts with query
  else if (nameLower.startsWith(queryLower)) {
    score += 8000;
  }
  // Name ends with query (e.g., "react" matches "preact")
  else if (nameLower.endsWith(queryLower)) {
    score += 6000;
  }
  // Name contains query as whole word
  else if (nameWords.includes(queryLower)) {
    score += 5000;
  }
  // Name contains query as substring
  else if (nameLower.includes(queryLower)) {
    score += 3000;
  }

  // Multi-word query matching in name
  if (queryWords.length > 1) {
    const allWordsInName = queryWords.every(qw => 
      nameWords.some(nw => nw.includes(qw) || qw.includes(nw))
    );
    if (allWordsInName) score += 4000;
    
    // Partial word matches
    const matchingWords = queryWords.filter(qw =>
      nameWords.some(nw => nw.includes(qw) || qw.includes(nw))
    ).length;
    score += matchingWords * 1000;
  }

  // Single word matches in name
  queryWords.forEach(qWord => {
    nameWords.forEach(nWord => {
      if (nWord === qWord) score += 1200; // Exact word match
      else if (nWord.startsWith(qWord)) score += 800; // Word starts with query
      else if (nWord.includes(qWord)) score += 400; // Word contains query
    });
  });

  // === FULL NAME / PATH MATCHING ===
  const fullNameLower = project.fullName.toLowerCase();
  if (fullNameLower.includes(queryLower)) score += 600;
  queryWords.forEach(qw => {
    if (fullNameLower.includes(qw)) score += 250;
  });

  // === DESCRIPTION MATCHING ===
  if (project.description) {
    const descLower = project.description.toLowerCase();
    const descWords = descLower.split(/\s+/);
    
    // Exact phrase in description
    if (descLower.includes(queryLower)) score += 800;
    
    // All query words in description
    if (queryWords.length > 1) {
      const allWordsInDesc = queryWords.every(qw => descLower.includes(qw));
      if (allWordsInDesc) score += 600;
    }
    
    // Individual word matches
    queryWords.forEach(qWord => {
      // Count occurrences (more mentions = more relevant)
      const occurrences = (descLower.match(new RegExp(qWord, 'g')) || []).length;
      score += Math.min(occurrences * 150, 600); // Cap at 600
      
      // Bonus if word appears early in description
      const firstIndex = descWords.findIndex(w => w.includes(qWord));
      if (firstIndex !== -1 && firstIndex < 10) {
        score += (10 - firstIndex) * 20;
      }
    });
  }

  // === TOPIC/TAG MATCHING (Very Important) ===
  const topicsLower = project.topics.map(t => t.toLowerCase());
  
  // Exact topic match
  const exactTopicMatches = topicsLower.filter(t => t === queryLower).length;
  score += exactTopicMatches * 2000;
  
  // Topic contains query
  const containsTopicMatches = topicsLower.filter(t => t.includes(queryLower)).length;
  score += containsTopicMatches * 800;
  
  // Query words match topics
  queryWords.forEach(qw => {
    const matches = topicsLower.filter(t => t === qw || t.includes(qw)).length;
    score += matches * 500;
  });

  // === AUTHOR MATCHING ===
  if (project.author.name.toLowerCase().includes(queryLower)) {
    score += 400;
  }

  // === POPULARITY METRICS ===
  // Stars (logarithmic scale to prevent mega-popular projects from dominating)
  if (project.stars > 0) {
    const starScore = Math.log10(project.stars + 1) * 200;
    score += Math.min(starScore, 2000); // Cap at 2000
    
    // Bonus for extremely popular projects
    if (project.stars > 10000) score += 500;
    if (project.stars > 50000) score += 500;
  }
  
  // Downloads (for npm, PyPI, Hugging Face)
  if (project.downloads && project.downloads > 0) {
    const downloadScore = Math.log10(project.downloads + 1) * 150;
    score += Math.min(downloadScore, 1500); // Cap at 1500
  }

  // === RECENCY & MAINTENANCE ===
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(project.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceUpdate < 7) score += 500;       // Updated this week
  else if (daysSinceUpdate < 30) score += 300; // Updated this month
  else if (daysSinceUpdate < 90) score += 150; // Updated this quarter
  else if (daysSinceUpdate < 180) score += 50; // Updated within 6 months
  else if (daysSinceUpdate > 365) score -= 200; // Stale (1+ year)
  else if (daysSinceUpdate > 730) score -= 500; // Very stale (2+ years)

  // === SOURCE QUALITY ===
  // Different sources have different quality indicators
  const sourceBonus: Record<SourceType, number> = {
    github: 150,       // Most popular for general code
    npm: 120,          // Popular for JS packages
    huggingface: 140,  // Popular for AI/ML
    pypi: 120,         // Popular for Python packages
    gitlab: 100,       // Less popular but still valuable
    crates: 120,       // Rust ecosystem
    codeberg: 100,     // FOSS git hosting
    packagist: 110,    // PHP packages
    rubygems: 110,     // Ruby gems
    hackernews: 90,    // Community discussion
    reddit: 90,        // Community discussion
  };
  score += sourceBonus[project.source] || 0;

  // === LICENSE ===
  if (project.license) {
    const licenseLower = project.license.toLowerCase();
    // Prefer permissive open source licenses
    if (licenseLower.includes('mit')) score += 100;
    else if (licenseLower.includes('apache')) score += 100;
    else if (licenseLower.includes('bsd')) score += 80;
    else if (licenseLower.includes('gpl')) score += 60;
    else if (!licenseLower.includes('proprietary')) score += 40;
  }

  // === LANGUAGE MATCHING ===
  if (project.language) {
    const langLower = project.language.toLowerCase();
    // Bonus if query matches language
    if (queryLower.includes(langLower) || langLower.includes(queryLower)) {
      score += 600;
    }
  }

  // === QUALITY INDICATORS ===
  // Projects with more topics tend to be better documented
  if (project.topics.length > 3) score += 100;
  if (project.topics.length > 6) score += 100;
  
  // Projects with descriptions are better
  if (project.description && project.description.length > 50) score += 150;
  if (project.description && project.description.length > 150) score += 100;

  return Math.max(0, score); // Ensure non-negative
}

export async function getProjectReadme(project: UnifiedProject): Promise<string | null> {
  try {
    switch (project.source) {
      case "github": {
        const [owner, repo] = project.fullName.split("/");
        const readmeNames = ["README.md", "readme.md", "Readme.md"];
        for (const filename of readmeNames) {
          try {
            const response = await fetch(
              `https://raw.githubusercontent.com/${owner}/${repo}/main/${filename}`
            );
            if (response.ok) return await response.text();
          } catch {}
        }
        return null;
      }
      case "huggingface": {
        const response = await fetch(
          `https://huggingface.co/${project.fullName}/raw/main/README.md`
        );
        if (response.ok) return await response.text();
        return null;
      }
      case "gitlab": {
        const response = await fetch(
          `https://gitlab.com/${project.fullName}/-/raw/main/README.md`
        );
        if (response.ok) return await response.text();
        return null;
      }
      case "npm": {
        const response = await fetch(`https://registry.npmjs.org/${project.name}`);
        if (response.ok) {
          const data = await response.json();
          return data.readme || null;
        }
        return null;
      }
      case "codeberg": {
        const [owner, repo] = project.fullName.split("/");
        for (const branch of ["main", "master"]) {
          try {
            const response = await fetch(
              `https://codeberg.org/${owner}/${repo}/raw/branch/${branch}/README.md`
            );
            if (response.ok) return await response.text();
          } catch {}
        }
        return null;
      }
      case "crates": {
        try {
          const response = await fetch(
            `https://crates.io/api/v1/crates/${project.name}`
          );
          if (response.ok) {
            const data = await response.json();
            return data.crate?.description || null;
          }
        } catch {}
        return null;
      }
      case "pypi": {
        try {
          const response = await fetch(
            `https://pypi.org/pypi/${project.name}/json`
          );
          if (response.ok) {
            const data = await response.json();
            return data.info?.description || null;
          }
        } catch {}
        return null;
      }
      case "packagist": {
        try {
          const response = await fetch(
            `https://repo.packagist.org/p2/${project.fullName}.json`
          );
          if (response.ok) {
            const data = await response.json();
            const firstVersion = Object.values(data.packages || {})[0] as any[];
            return firstVersion?.[0]?.description || null;
          }
        } catch {}
        return null;
      }
      case "rubygems":
      case "hackernews":
      case "reddit":
        return project.description;
      default:
        return null;
    }
  } catch (error) {
    console.error("Error fetching README:", error);
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
  };
  return configs[source];
}

