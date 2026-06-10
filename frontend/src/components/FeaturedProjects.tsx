"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { UnifiedProjectCard } from "./UnifiedProjectCard";
import type { UnifiedProject } from "@/lib/sources/types";
import { ghFetch } from "@/lib/github";

// Iter-22 / Overhaul H — Track 2 (the headline visible change)
//
// Curated 3-card row of known-good projects, visible immediately on the
// landing page. Reuses UnifiedProjectCard so featured projects share the
// exact same vocabulary as search results — one card design, two
// surfaces.
//
// Data flow:
//   1. On first mount, read `threadseeker:featured:v1` from sessionStorage.
//   2. If present and < 24h old, render immediately (zero network).
//   3. Otherwise fetch each pinned slug via /api/gh (server-side token + edge
//      cache; direct fallback in plain dev) and map into UnifiedProject. If any
//      single fetch fails the others still render — partial degradation rather
//      than hard fail.
//   4. Cache the merged result with a 24h TTL.

const FEATURED_SLUGS = [
  "vercel/next.js",
  "huggingface/transformers",
  "tailwindlabs/tailwindcss",
];

const CACHE_KEY = "threadseeker:featured:v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Static fallback so the hero is NEVER empty — if GitHub is rate-limited on a
// cold visit (the worst first-impression failure mode, since Featured +
// Trending + OG covers are all GitHub-backed), the section still renders these
// curated, stable flagship repos. Star counts are approximate (these don't
// swing) and updatedAt is blank so no stale "updated X ago" is shown. The OG
// cover banners still load — they come from opengraph.githubassets.com, a
// different host than the rate-limited api.github.com.
const FEATURED_FALLBACK: UnifiedProject[] = [
  {
    id: "github-fallback-nextjs", source: "github", name: "next.js",
    fullName: "vercel/next.js",
    description: "The React Framework — created and maintained by Vercel.",
    url: "https://github.com/vercel/next.js", stars: 128000, language: "TypeScript",
    topics: ["react", "framework", "ssr", "static-site-generator", "vercel"],
    author: { name: "vercel", avatar: "https://github.com/vercel.png?size=96" },
    updatedAt: "", homepage: "https://nextjs.org",
  },
  {
    id: "github-fallback-transformers", source: "github", name: "transformers",
    fullName: "huggingface/transformers",
    description: "State-of-the-art Machine Learning for PyTorch, TensorFlow, and JAX.",
    url: "https://github.com/huggingface/transformers", stars: 138000, language: "Python",
    topics: ["machine-learning", "nlp", "pytorch", "transformers", "llm"],
    author: { name: "huggingface", avatar: "https://github.com/huggingface.png?size=96" },
    updatedAt: "", homepage: "https://huggingface.co/transformers",
  },
  {
    id: "github-fallback-tailwind", source: "github", name: "tailwindcss",
    fullName: "tailwindlabs/tailwindcss",
    description: "A utility-first CSS framework for rapid UI development.",
    url: "https://github.com/tailwindlabs/tailwindcss", stars: 84000, language: "TypeScript",
    topics: ["css", "framework", "ui", "design"],
    author: { name: "tailwindlabs", avatar: "https://github.com/tailwindlabs.png?size=96" },
    updatedAt: "", homepage: "https://tailwindcss.com",
  },
];

interface CachedShape {
  at: number;
  data: UnifiedProject[];
}

interface Props {
  onTopicClick: (topic: string) => void;
  onOpenDetails: (project: UnifiedProject) => void;
  onToast: (msg: string) => void;
}

function loadCache(): UnifiedProject[] | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedShape;
    if (!parsed || typeof parsed.at !== "number" || !Array.isArray(parsed.data)) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function saveCache(data: UnifiedProject[]) {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

async function fetchRepo(slug: string): Promise<UnifiedProject | null> {
  try {
    const response = await ghFetch(`https://api.github.com/repos/${slug}`);
    if (!response || !response.ok) return null;
    const item = await response.json();
    return {
      id: `github-${item.id}`,
      source: "github",
      name: item.name,
      fullName: item.full_name,
      description: item.description,
      url: item.html_url,
      stars: item.stargazers_count ?? 0,
      language: item.language ?? null,
      topics: item.topics ?? [],
      author: {
        name: item.owner?.login || item.full_name?.split("/")[0] || "unknown",
        avatar:
          item.owner?.avatar_url ||
          (item.owner?.login ? `https://github.com/${item.owner.login}.png?size=96` : ""),
      },
      updatedAt: item.updated_at,
      license: item.license?.name || item.license?.spdx_id,
      homepage: item.homepage || undefined,
      forks: item.forks_count,
      openIssues: item.open_issues_count,
      watchers: item.watchers_count,
      createdAt: item.created_at,
    };
  } catch {
    return null;
  }
}

export function FeaturedProjects({ onTopicClick, onOpenDetails, onToast }: Props) {
  // Initialize with the static fallback instead of skeletons: the fallback IS
  // the same three pinned repos the live fetch loads, so SSR can render the
  // full cards — putting the OG cover URLs in the static HTML, where the
  // browser's preload scanner discovers the LCP image BEFORE hydration
  // (measured on prod: lazy+post-hydration discovery cost ~1.2s of LCP).
  // The live fetch then refreshes star counts/dates in place — same cards,
  // no content swap, no skeleton flash, no layout shift.
  const [projects, setProjects] = useState<UnifiedProject[]>(FEATURED_FALLBACK);

  useEffect(() => {
    const cached = loadCache();
    if (cached && cached.length > 0) {
      setProjects(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(FEATURED_SLUGS.map((s) => fetchRepo(s)));
      const filtered = results.filter((p): p is UnifiedProject => !!p);
      if (cancelled) return;
      // GitHub down / rate-limited → the fallback is already on screen; keep
      // it (and don't cache it, so a later load retries live).
      if (filtered.length === 0) return;
      setProjects(filtered);
      saveCache(filtered);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="ts-featured" aria-labelledby="ts-featured-head">
      <div className="ts-featured-head">
        <h2 id="ts-featured-head" className="ts-section-header">
          <Sparkles className="inline-block w-3 h-3 mr-1" aria-hidden />
          {"// Featured "}
          <strong>· curated weekly</strong>
        </h2>
        <a
          href="https://github.com/trending"
          target="_blank"
          rel="noopener noreferrer"
          className="ts-featured-link"
        >
          View all
          <ArrowRight className="w-3 h-3" aria-hidden />
        </a>
      </div>
      <div className="ts-featured-grid">
        {projects.map((p, idx) => (
          <UnifiedProjectCard
            key={p.id}
            project={p}
            index={idx}
            onToast={onToast}
            onTopicClick={onTopicClick}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>
    </section>
  );
}
