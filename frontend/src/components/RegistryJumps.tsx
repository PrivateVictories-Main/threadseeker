"use client";

// Iter-23 / Major Overhaul I — landing-page registry jumps row.
//
// On the landing page we want a compact, marketing-style row of "open
// the search page on each registry" pills, distinct from the
// query-aware DirectJumps component which only renders when the user
// has typed a bare package name. RegistryJumps surfaces the canonical
// browse URLs for the four most-jumped registries.

import {
  Boxes,
  Container,
  Package,
  Package2,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

interface Registry {
  name: string;
  icon: LucideIcon;
  href: string;
  tagline: string;
}

const REGISTRIES: Registry[] = [
  {
    name: "npm",
    icon: Package,
    href: "https://www.npmjs.com/",
    tagline: "Node.js packages",
  },
  {
    name: "PyPI",
    icon: Package2,
    href: "https://pypi.org/",
    tagline: "Python packages",
  },
  {
    name: "crates.io",
    icon: Boxes,
    href: "https://crates.io/",
    tagline: "Rust packages",
  },
  {
    name: "Docker Hub",
    icon: Container,
    href: "https://hub.docker.com/",
    tagline: "Container images",
  },
];

export function RegistryJumps() {
  return (
    <div className="ts-registry-jumps">
      {REGISTRIES.map((r) => {
        const Icon = r.icon;
        return (
          <a
            key={r.name}
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            className="ts-registry-pill"
          >
            <span className="ts-registry-pill-icon" aria-hidden>
              <Icon className="w-4 h-4" />
            </span>
            <span className="ts-registry-pill-text">
              <span className="ts-registry-pill-name">{r.name}</span>
              <span className="ts-registry-pill-tag">{r.tagline}</span>
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" aria-hidden />
          </a>
        );
      })}
    </div>
  );
}
