"use client";

// Iter-23 / Major Overhaul I — visual category grid.
//
// Sits on the landing as a second navigation surface alongside the
// sidebar. While the sidebar exposes categories as text rows,
// CategoryGrid presents them as a 2-3 col tile grid with icon + label
// + the count of sources that map into that category. Click flips the
// active category (same handler as the sidebar) so the next search
// honors the narrowed source set.
//
// Visual: glass-strong tiles with a subtle hover lift. Active tile gets
// the indigo gradient fill and an inner glow (mirroring the sidebar
// active state so the two views agree).

import { motion } from "framer-motion";
import {
  Globe,
  GitBranch,
  Package,
  Cpu,
  FileText,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_DEFS, type CategoryKey } from "./CategoryNav";

interface Props {
  activeKey: CategoryKey;
  onSelect: (key: CategoryKey) => void;
}

// Iter-24 — staggered tile reveal so the 6 tiles pop in left-to-right
// at 80ms per child rather than all at once. Honors reduced-motion.
const gridContainer = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const tileChild = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 220, damping: 24, mass: 0.85 },
  },
};

const ICON_BY_KEY: Record<CategoryKey, LucideIcon> = {
  all: Globe,
  repos: GitBranch,
  packages: Package,
  ai: Cpu,
  papers: FileText,
  threads: MessageSquare,
};

const TAGLINE_BY_KEY: Record<CategoryKey, string> = {
  all: "Every source — the full ThreadSeeker index",
  repos: "GitHub, GitLab, Codeberg",
  packages: "npm, PyPI, crates, RubyGems, NuGet, Docker…",
  ai: "Hugging Face models + Papers with Code",
  papers: "arXiv, Zenodo, Papers with Code",
  threads: "Hacker News, Reddit, Lobsters, Stack Overflow, dev.to",
};

export function CategoryGrid({ activeKey, onSelect }: Props) {
  return (
    <section className="ts-landing-row" aria-labelledby="ts-cat-grid-h">
      <h2 id="ts-cat-grid-h" className="ts-section-header">
        {"// Browse by category"}
      </h2>
      <motion.div
        className="ts-category-grid"
        variants={gridContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        {CATEGORY_DEFS.map((cat) => {
          const Icon = ICON_BY_KEY[cat.key] ?? cat.icon;
          const isActive = cat.key === activeKey;
          const count =
            cat.sources === "all" ? null : cat.sources.length;
          return (
            <motion.button
              key={cat.key}
              type="button"
              className={`ts-category-tile${isActive ? " is-active" : ""}`}
              onClick={() => onSelect(cat.key)}
              aria-pressed={isActive}
              variants={tileChild}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="ts-category-tile-icon" aria-hidden>
                <Icon className="w-5 h-5" />
              </span>
              <span className="ts-category-tile-text">
                <span className="ts-category-tile-label">{cat.label}</span>
                <span className="ts-category-tile-tagline">
                  {TAGLINE_BY_KEY[cat.key]}
                </span>
              </span>
              {count !== null && (
                <span className="ts-category-tile-count" aria-label={`${count} sources`}>
                  {count}
                </span>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </section>
  );
}
