"use client";

// When the query looks like a bare package name (single token, slug-ish),
// offer one-click deep links to the canonical package page on each
// registry. Skips anything with spaces, operators, or special chars.

import { ArrowUpRight } from "lucide-react";

interface Props {
  query: string;
}

// registry name → page-url template. Slug regex ensures we only link when
// the query is actually a valid package id for that registry.
const REGISTRIES: Array<{
  name: string;
  icon: string;
  slug: RegExp;
  url: (q: string) => string;
}> = [
  {
    name: "npm",
    icon: "📦",
    slug: /^@?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)?$/i,
    url: (q) => `https://www.npmjs.com/package/${encodeURIComponent(q)}`,
  },
  {
    name: "PyPI",
    icon: "🐍",
    slug: /^[a-z0-9][a-z0-9._-]*$/i,
    url: (q) => `https://pypi.org/project/${encodeURIComponent(q)}/`,
  },
  {
    name: "crates.io",
    icon: "📦",
    slug: /^[a-z0-9][a-z0-9_-]*$/i,
    url: (q) => `https://crates.io/crates/${encodeURIComponent(q)}`,
  },
  {
    name: "Docker Hub",
    icon: "🐳",
    slug: /^[a-z0-9][a-z0-9._-]*$/i,
    url: (q) => `https://hub.docker.com/_/${encodeURIComponent(q)}`,
  },
  {
    name: "RubyGems",
    icon: "💎",
    slug: /^[a-z0-9][a-z0-9_-]*$/i,
    url: (q) => `https://rubygems.org/gems/${encodeURIComponent(q)}`,
  },
  {
    name: "Packagist",
    icon: "🐘",
    slug: /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i,
    url: (q) => `https://packagist.org/packages/${encodeURIComponent(q)}`,
  },
];

export function DirectJumps({ query }: Props) {
  const q = query.trim();
  if (!q || /\s/.test(q) || q.length > 60) return null;
  const hits = REGISTRIES.filter((r) => r.slug.test(q));
  if (hits.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-900/20 bg-amber-950/10 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-amber-300/70">
          Jump to <span className="font-mono text-amber-200">{q}</span> on
        </span>
        {hits.map((r) => (
          <a
            key={r.name}
            href={r.url(q)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-slate-100 bg-slate-900/60 hover:bg-slate-800/70 border border-slate-800/50 hover:border-slate-700/60 rounded-full px-2.5 py-1 transition-colors"
          >
            <span>{r.icon}</span>
            <span>{r.name}</span>
            <ArrowUpRight className="w-3 h-3 text-slate-600" />
          </a>
        ))}
      </div>
    </div>
  );
}
