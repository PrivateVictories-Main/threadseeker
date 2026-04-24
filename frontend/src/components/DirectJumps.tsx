"use client";

// When the query looks like a bare package name (single token, slug-ish),
// offer one-click deep links to the canonical package page on each
// registry. Skips anything with spaces, operators, or special chars.

import {
  ArrowUpRight,
  Boxes,
  Container,
  Gem,
  Package,
  Package2,
  type LucideIcon,
} from "lucide-react";

interface Props {
  query: string;
}

// registry name → page-url template. Slug regex ensures we only link when
// the query is actually a valid package id for that registry.
// Icons mirror the source-registry choices in `lib/sources/registry.ts`
// so a "jump to npm" pill reads identical to the npm chip in
// SourceFilter / ResultsToolbar.
const REGISTRIES: Array<{
  name: string;
  icon: LucideIcon;
  slug: RegExp;
  url: (q: string) => string;
}> = [
  {
    name: "npm",
    icon: Package,
    slug: /^@?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)?$/i,
    url: (q) => `https://www.npmjs.com/package/${encodeURIComponent(q)}`,
  },
  {
    name: "PyPI",
    // Package2 (layered package) differentiates the Python wheel from
    // npm's plain Package — same registry-icon vocabulary as registry.ts.
    icon: Package2,
    slug: /^[a-z0-9][a-z0-9._-]*$/i,
    url: (q) => `https://pypi.org/project/${encodeURIComponent(q)}/`,
  },
  {
    name: "crates.io",
    // Boxes (stacked boxes) reads as Cargo's crate-aggregate model.
    icon: Boxes,
    slug: /^[a-z0-9][a-z0-9_-]*$/i,
    url: (q) => `https://crates.io/crates/${encodeURIComponent(q)}`,
  },
  {
    name: "Docker Hub",
    icon: Container,
    slug: /^[a-z0-9][a-z0-9._-]*$/i,
    url: (q) => `https://hub.docker.com/_/${encodeURIComponent(q)}`,
  },
  {
    name: "RubyGems",
    icon: Gem,
    slug: /^[a-z0-9][a-z0-9_-]*$/i,
    url: (q) => `https://rubygems.org/gems/${encodeURIComponent(q)}`,
  },
  {
    name: "Packagist",
    icon: Package,
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
      {/* Breakpoint cadence aligns with the rest of the app:
          <md (≤768px): inline single-row "Jump to <pkg> · [npm] [PyPI]…"
                        — phones AND small tablets where vertical space
                        is still tight and the card grid is 1–2 cols.
          ≥md         : stacked sectioned card with title + pill row,
                        matching the cadence the SearchBar header and
                        SavedSection switch from compact to comfortable.
          The inline variant flex-wraps the prefix to its own line at
          ≤sm so iPhone-SE 320px doesn't need to truncate the name. */}
      <div className="md:hidden flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[12px] text-slate-500">
        <span className="inline-flex items-center gap-x-1.5 basis-full sm:basis-auto">
          <span className="uppercase tracking-[0.14em] font-semibold text-[10.5px] text-slate-400">
            Jump to
          </span>
          <span className="font-mono text-slate-700 truncate">{q}</span>
        </span>
        {hits.map((r) => {
          const Icon = r.icon;
          return (
            <a
              key={r.name}
              href={r.url(q)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-2 py-1 transition-colors"
            >
              <Icon className="w-3 h-3" aria-hidden />
              <span>{r.name}</span>
            </a>
          );
        })}
      </div>
      <div className="hidden md:block">
        <h3 className="section-title">
          Jump to <span className="font-mono normal-case tracking-normal text-slate-600">{q}</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {hits.map((r) => {
            const Icon = r.icon;
            return (
              <a
                key={r.name}
                href={r.url(q)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 hover:text-indigo-700 bg-white/80 hover:bg-white border border-indigo-200 hover:border-indigo-400 rounded-full px-3 py-1.5 transition-colors"
              >
                <Icon className="w-3.5 h-3.5" aria-hidden />
                <span>{r.name}</span>
                <ArrowUpRight className="w-3 h-3 text-slate-400" />
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
