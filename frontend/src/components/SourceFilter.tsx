"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SourceType, getSourceConfig } from "@/lib/sources";
import { sheetVariants } from "@/lib/motion";

interface SourceFilterProps {
  allSources: SourceType[];
  selectedSources: SourceType[];
  onToggle: (source: SourceType) => void;
  onClear?: () => void;
  open?: boolean;
}

// Grouping the 28 sources into five human categories keeps the sheet
// scannable — "npm, pypi, crates, packagist…" in a single row reads as
// noise; broken into Repos / Packages / Community / AI+ML / Scholarly
// it reads like a table of contents.
const CATEGORIES: Array<{ title: string; sources: SourceType[] }> = [
  {
    title: "Repos",
    sources: ["github", "gitlab", "codeberg"],
  },
  {
    title: "Packages",
    sources: [
      "npm",
      "pypi",
      "crates",
      "rubygems",
      "packagist",
      "jsr",
      "dockerhub",
      "conda",
      "nuget",
      "maven",
      "homebrew",
      "fdroid",
      "aur",
      "flathub",
      "openvsx",
      "wordpress",
    ],
  },
  {
    title: "AI & ML",
    sources: ["huggingface", "paperswithcode"],
  },
  {
    title: "Community",
    sources: ["hackernews", "reddit", "lobsters", "stackoverflow", "devto"],
  },
  {
    title: "Scholarly",
    sources: ["arxiv", "zenodo"],
  },
];

export function SourceFilter({
  allSources,
  selectedSources,
  onToggle,
  onClear,
  open = true,
}: SourceFilterProps) {
  const allowed = new Set<SourceType>(allSources);
  const canClear = selectedSources.length < allSources.length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="glass-strong source-filter-sheet"
          variants={sheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-slate-400">
              Sources · {selectedSources.length}/{allSources.length}
            </h4>
            {onClear && (
              <button
                onClick={onClear}
                disabled={!canClear}
                className="text-[11px] font-medium text-slate-400 hover:text-indigo-600 disabled:opacity-0 disabled:pointer-events-none transition-colors"
                aria-label="Reset to all sources"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {CATEGORIES.map((cat) => {
              const visible = cat.sources.filter((s) => allowed.has(s));
              if (visible.length === 0) return null;
              return (
                <div key={cat.title}>
                  <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400 mb-2">
                    {cat.title}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {visible.map((source) => {
                      const config = getSourceConfig(source);
                      const active = selectedSources.includes(source);
                      return (
                        <button
                          key={source}
                          onClick={() => onToggle(source)}
                          data-active={String(active)}
                          className="filter-pill pill text-[12px] flex items-center gap-1.5"
                        >
                          <span className="text-[12px]">{config.icon}</span>
                          <span>{config.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
