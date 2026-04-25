"use client";

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
import type { SourceType } from "@/lib/sources/types";

// Iter-22 / Overhaul H — Track 1
//
// HuggingFace-inspired horizontal category navigation strip. Sits below the
// hero search bar, above the stat tiles. Each pill maps to a hand-curated
// set of source types that share the same content shape:
//
//   All        — every source (resets the chip selection)
//   Repos      — github / gitlab / codeberg
//   Packages   — npm / pypi / crates / rubygems / packagist / nuget / jsr /
//                conda / homebrew / dockerhub / flathub / fdroid / aur /
//                openvsx / wordpress / maven
//   AI Models  — huggingface / paperswithcode (model-shaped community)
//   Papers     — arxiv / zenodo / paperswithcode
//   Threads    — hackernews / reddit / lobsters / stackoverflow / devto
//
// Active state = indigo gradient fill + white text + soft glow.
// Inactive    = ghost glass with mono uppercase 11px text.
// Hover       = scale(1.03) + indigo tint background.
//
// Whole strip sits on a glass-strong rounded-full surface ~52px tall.

export type CategoryKey = "all" | "repos" | "packages" | "ai" | "papers" | "threads";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  icon: LucideIcon;
  sources: SourceType[] | "all";
}

export const CATEGORY_DEFS: CategoryDef[] = [
  { key: "all", label: "All sources", icon: Globe, sources: "all" },
  {
    key: "repos",
    label: "Repositories",
    icon: GitBranch,
    sources: ["github", "gitlab", "codeberg"],
  },
  {
    key: "packages",
    label: "Packages",
    icon: Package,
    sources: [
      "npm",
      "pypi",
      "crates",
      "rubygems",
      "packagist",
      "nuget",
      "jsr",
      "conda",
      "homebrew",
      "dockerhub",
      "flathub",
      "fdroid",
      "aur",
      "openvsx",
      "wordpress",
      "maven",
    ],
  },
  { key: "ai", label: "AI Models", icon: Cpu, sources: ["huggingface", "paperswithcode"] },
  { key: "papers", label: "Papers", icon: FileText, sources: ["arxiv", "zenodo", "paperswithcode"] },
  {
    key: "threads",
    label: "Threads",
    icon: MessageSquare,
    sources: ["hackernews", "reddit", "lobsters", "stackoverflow", "devto"],
  },
];

interface Props {
  activeKey: CategoryKey;
  onChange: (key: CategoryKey) => void;
}

export function CategoryNav({ activeKey, onChange }: Props) {
  return (
    <nav
      className="ts-category-nav"
      aria-label="Filter by content category"
    >
      <div className="ts-category-nav-inner">
        {CATEGORY_DEFS.map((cat) => {
          const Icon = cat.icon;
          const isActive = cat.key === activeKey;
          return (
            <motion.button
              key={cat.key}
              type="button"
              onClick={() => onChange(cat.key)}
              className={`ts-category-pill${isActive ? " is-active" : ""}`}
              aria-pressed={isActive}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 360, damping: 24 }}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden />
              <span>{cat.label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
