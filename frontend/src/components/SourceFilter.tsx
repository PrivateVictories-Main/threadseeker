"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  SourceType,
  getSourceConfig,
  groupSourcesByCategory,
} from "@/lib/sources";
import { sheetVariants } from "@/lib/motion";

interface SourceFilterProps {
  allSources: SourceType[];
  selectedSources: SourceType[];
  onToggle: (source: SourceType) => void;
  onClear?: () => void;
  open?: boolean;
}

// Categories are now declared per-source on the registry (see
// `SourceDisplayConfig.category` in registry.ts). Adding a new source
// = declaring its category once; SourceFilter groups dynamically.
export function SourceFilter({
  allSources,
  selectedSources,
  onToggle,
  onClear,
  open = true,
}: SourceFilterProps) {
  const canClear = selectedSources.length < allSources.length;
  const groups = useMemo(() => groupSourcesByCategory(allSources), [allSources]);

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
            {groups.map((group) => {
              // N selected / M available in this category — gives the user
              // a glanceable read of "Repos 2/4" without having to scan
              // every chip's active state. Tabular nums so "2/4" and "10/12"
              // line up under each other vertically when category headers
              // stack on a narrow viewport.
              const total = group.sources.length;
              const active = group.sources.reduce(
                (n, s) => n + (selectedSources.includes(s) ? 1 : 0),
                0,
              );
              return (
                <div key={group.category}>
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400">
                      {group.title}
                    </div>
                    <div className="text-[10px] tabular-nums font-medium text-slate-400">
                      <span
                        className={
                          active === total
                            ? "text-indigo-600"
                            : active === 0
                              ? "text-slate-300"
                              : ""
                        }
                      >
                        {active}
                      </span>
                      <span className="text-slate-300">/{total}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.sources.map((source) => {
                      const config = getSourceConfig(source);
                      const isActive = selectedSources.includes(source);
                      return (
                        <button
                          key={source}
                          onClick={() => onToggle(source)}
                          data-active={String(isActive)}
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
