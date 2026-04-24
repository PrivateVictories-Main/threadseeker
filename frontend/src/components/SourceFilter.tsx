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
  // Optional bulk-set hook for the per-category All/None toggle. When
  // omitted the toggle is hidden (single-source-toggle parents still work).
  onSetSelected?: (next: SourceType[]) => void;
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
  onSetSelected,
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
              // When every chip in a category is de-selected the section
              // visually recedes (~60% opacity) so the eye reads "nothing
              // active here" without the user having to count chips. Chips
              // stay clickable — fade is purely visual, not pointer-events.
              const allInactive = active === 0;
              const allActive = active === total;
              // Per-category bulk toggle — flips between selecting every
              // chip in the category and removing every chip. Label
              // mirrors the action: at full, the button reads "None"
              // (it'll deselect); otherwise "All" (it'll select rest).
              // Guards against emptying the global selection: if turning
              // off this category would leave zero sources selected
              // overall, the toggle short-circuits to a no-op so the
              // results don't suddenly go blank.
              const handleCategoryToggle = () => {
                if (!onSetSelected) return;
                const groupSet = new Set(group.sources);
                const others = selectedSources.filter((s) => !groupSet.has(s));
                if (allActive) {
                  // Don't allow toggling off the last remaining category.
                  if (others.length === 0) return;
                  onSetSelected(others);
                } else {
                  onSetSelected([...others, ...group.sources]);
                }
              };
              return (
                <div key={group.category}>
                  {/* Header row stays at full opacity so the All/None
                      toggle and category title remain crisp/discoverable
                      even when the chip cluster below is in zero-state
                      fade. Only the chip section recedes — the affordance
                      to bring the category back never reads as disabled. */}
                  <div className="flex items-baseline justify-between mb-2 gap-2">
                    <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-400">
                      {group.title}
                    </div>
                    <div className="flex items-baseline gap-2">
                      {onSetSelected && (
                        // Tap-target pattern: outer <button> stays at the
                        // 10px caption-scale font but uses negative margin
                        // + generous padding to claw out a 44×44 hit area
                        // (Apple HIG / WCAG 2.5.5 minimum) without
                        // changing the visible text size or row layout.
                        // The inner <span> carries the visual styling so
                        // hover/active state still reads at caption scale.
                        <button
                          type="button"
                          onClick={handleCategoryToggle}
                          className="group -my-2 -mx-1.5 px-1.5 py-2 inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:m-0 sm:p-0"
                          aria-label={
                            allActive
                              ? `Deselect all ${group.title} sources`
                              : `Select all ${group.title} sources`
                          }
                        >
                          <span className="text-[10px] font-medium text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-[0.08em]">
                            {allActive ? "None" : "All"}
                          </span>
                        </button>
                      )}
                      <div className="text-[10px] tabular-nums font-medium text-slate-400">
                        <span
                          className={
                            allActive
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
                  </div>
                  <div
                    className={`flex flex-wrap gap-1.5 transition-opacity duration-200 ${allInactive ? "opacity-60" : "opacity-100"}`}
                  >
                    {group.sources.map((source) => {
                      const config = getSourceConfig(source);
                      const Icon = config.lucideIcon;
                      const isActive = selectedSources.includes(source);
                      return (
                        <button
                          key={source}
                          onClick={() => onToggle(source)}
                          data-active={String(isActive)}
                          className="filter-pill pill text-[12px] flex items-center gap-1.5"
                        >
                          <Icon className="w-3.5 h-3.5" aria-hidden />
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
