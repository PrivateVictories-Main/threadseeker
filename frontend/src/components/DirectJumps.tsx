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
    <div className="glass section-container">
      {/* Desktop: stacked title + pill row. Mobile: single inline "Jump to
          <pkg> on: [npm] [PyPI]…" so the section doesn't claim two rows of
          vertical space on phones. */}
      <div className="sm:hidden flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[12px] text-slate-500">
        {/* iPhone-SE-friendly mobile layout — tighter horizontal gap (1.5
            vs 2), the package name allowed to take its own row if needed
            (basis-full on the prefix cluster), pills shrunk to 11.5px
            with px-2 so 6 pills fit in two clean rows on 320px width. */}
        <span className="inline-flex items-center gap-x-1.5 basis-full sm:basis-auto">
          <span className="uppercase tracking-[0.14em] font-semibold text-[10.5px] text-slate-400">
            Jump to
          </span>
          <span className="font-mono text-slate-700 truncate">{q}</span>
        </span>
        {hits.map((r) => (
          <a
            key={r.name}
            href={r.url(q)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-2 py-1 transition-colors"
          >
            {/* 14px emoji icon — readable on phone, leading-none keeps
                the pill height honest. */}
            <span className="text-[14px] leading-none">{r.icon}</span>
            <span>{r.name}</span>
          </a>
        ))}
      </div>
      <div className="hidden sm:block">
        <h3 className="section-title">
          Jump to <span className="font-mono normal-case tracking-normal text-slate-600">{q}</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {hits.map((r) => (
            <a
              key={r.name}
              href={r.url(q)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3 py-1.5 transition-colors"
            >
              <span>{r.icon}</span>
              <span>{r.name}</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
