"use client";

import { UnifiedProject, SourceType, getSourceConfig } from "@/lib/sources";
import {
  ArrowDownWideNarrow,
  Link2,
  Check,
  Download,
  Filter,
  ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { springSnappy, springSoft } from "@/lib/motion";

export type SortMode = "relevance" | "stars" | "updated" | "downloads";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "stars", label: "Most stars" },
  { value: "updated", label: "Recently updated" },
  { value: "downloads", label: "Most downloads" },
];

interface Props {
  projects: UnifiedProject[];
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  activeSource: SourceType | null;
  onSourceClick: (source: SourceType | null) => void;
}

function toMarkdown(projects: UnifiedProject[]): string {
  const lines = ["# ThreadSeeker results", ""];
  const bySource = new Map<SourceType, UnifiedProject[]>();
  for (const p of projects) {
    const arr = bySource.get(p.source) ?? [];
    arr.push(p);
    bySource.set(p.source, arr);
  }
  for (const [source, list] of bySource) {
    const cfg = getSourceConfig(source);
    lines.push(`## ${cfg.icon} ${cfg.name}`, "");
    for (const p of list) {
      const stars = p.stars ? ` · ⭐ ${p.stars.toLocaleString()}` : "";
      const desc = p.description ? ` — ${p.description}` : "";
      lines.push(`- [${p.fullName}](${p.url})${stars}${desc}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function ResultsToolbar({
  projects,
  sortMode,
  onSortChange,
  activeSource,
  onSourceClick,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [exportedAs, setExportedAs] = useState<null | "md" | "json">(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside-click.
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!sortRef.current) return;
      if (!sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [sortOpen]);

  const handleExport = async (kind: "md" | "json") => {
    const payload =
      kind === "md"
        ? toMarkdown(projects)
        : JSON.stringify(
            projects.map((p) => ({
              name: p.fullName,
              source: p.source,
              url: p.url,
              description: p.description,
              stars: p.stars,
              language: p.language,
            })),
            null,
            2,
          );
    try {
      await navigator.clipboard.writeText(payload);
      setExportedAs(kind);
      setTimeout(() => setExportedAs(null), 900);
      toast.success(`Copied ${projects.length} results as ${kind.toUpperCase()}`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url, title: "ThreadSeeker" });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      /* user cancelled or clipboard unavailable */
    }
  };
  const counts = new Map<SourceType, number>();
  for (const p of projects) {
    counts.set(p.source, (counts.get(p.source) ?? 0) + 1);
  }
  const orderedSources = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const activeSourceCount = orderedSources.length;
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sortMode)?.label ?? "Relevance";

  return (
    <div className="glass flex flex-col gap-2 px-4 py-2.5 rounded-xl">
      {/* Two logical groups: [Sources + Sort] on the left, [MD/JSON/Share]
          on the right. Both clusters are flex-wrap with min-w-0 so a narrow
          viewport breaks the row between groups instead of awkwardly
          mid-button or stacking every control on its own line. */}
      <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className="btn btn-ghost text-[12.5px] h-8 px-3 min-w-0"
            aria-expanded={filterOpen}
            title={
              activeSource
                ? `Sources · ${getSourceConfig(activeSource).name} (click to change)`
                : `Filter by source · All ${activeSourceCount}`
            }
            aria-label={
              activeSource
                ? `Filter by source. Currently showing ${getSourceConfig(activeSource).name}.`
                : `Filter by source. Currently showing all ${activeSourceCount} sources.`
            }
          >
            <Filter className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              Sources
              {activeSource ? (
                <span className="ml-1 text-indigo-700">· {getSourceConfig(activeSource).name}</span>
              ) : (
                <span className="ml-1 text-slate-400">· All {activeSourceCount}</span>
              )}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${filterOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="btn btn-ghost text-[12.5px] h-8 px-3"
              aria-expanded={sortOpen}
              aria-haspopup="listbox"
              title={`Sort: ${currentSortLabel}`}
              aria-label={`Sort order. Currently sorted by ${currentSortLabel}.`}
            >
              <ArrowDownWideNarrow className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{currentSortLabel}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${sortOpen ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence>
              {sortOpen && (
                <motion.ul
                  role="listbox"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: springSoft }}
                  exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
                  className="absolute right-0 top-[calc(100%+4px)] z-30 glass-strong min-w-[180px] p-1.5 text-[12.5px]"
                >
                  {SORT_OPTIONS.map((o) => {
                    const active = o.value === sortMode;
                    return (
                      <li key={o.value}>
                        <button
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            onSortChange(o.value);
                            setSortOpen(false);
                          }}
                          className={`w-full text-left rounded-md px-3 py-1.5 flex items-center justify-between gap-4 transition-colors ${
                            active
                              ? "bg-indigo-50 text-indigo-700 font-semibold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span>{o.label}</span>
                          {active && <Check className="w-3.5 h-3.5" />}
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap min-w-0">
          <motion.button
            onClick={() => handleExport("md")}
            className="btn btn-ghost text-[12.5px] h-8 px-3"
            title="Copy results as Markdown"
            animate={{
              backgroundColor:
                exportedAs === "md" ? "rgba(236, 253, 245, 1)" : "rgba(255, 255, 255, 0)",
              borderColor:
                exportedAs === "md" ? "rgba(16, 185, 129, 0.35)" : "rgba(99, 102, 241, 0.14)",
            }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {exportedAs === "md" ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>MD</span>
          </motion.button>
          <motion.button
            onClick={() => handleExport("json")}
            className="btn btn-ghost text-[12.5px] h-8 px-3"
            title="Copy results as JSON"
            animate={{
              backgroundColor:
                exportedAs === "json" ? "rgba(236, 253, 245, 1)" : "rgba(255, 255, 255, 0)",
              borderColor:
                exportedAs === "json" ? "rgba(16, 185, 129, 0.35)" : "rgba(99, 102, 241, 0.14)",
            }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {exportedAs === "json" ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>JSON</span>
          </motion.button>
          <motion.button
            onClick={handleShare}
            className="btn btn-ghost text-[12.5px] h-8 px-3"
            title="Copy link to these results"
            animate={{
              backgroundColor:
                copied ? "rgba(236, 253, 245, 1)" : "rgba(255, 255, 255, 0)",
              borderColor:
                copied ? "rgba(16, 185, 129, 0.35)" : "rgba(99, 102, 241, 0.14)",
            }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {filterOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transition: springSoft }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
            className="overflow-hidden"
          >
            <div className="pt-2 flex flex-wrap items-center gap-1.5">
              <motion.button
                onClick={() => onSourceClick(null)}
                data-active={String(activeSource === null)}
                className="filter-pill pill text-[12px]"
                animate={{
                  backgroundColor:
                    activeSource === null ? "#6366f1" : "rgba(255,255,255,0.92)",
                  color: activeSource === null ? "#ffffff" : undefined,
                }}
                transition={springSnappy}
              >
                All {projects.length}
              </motion.button>
              {orderedSources.map(([source, count]) => {
                const cfg = getSourceConfig(source);
                const active = activeSource === source;
                return (
                  <motion.button
                    key={source}
                    onClick={() => onSourceClick(active ? null : source)}
                    data-active={String(active)}
                    className="filter-pill pill text-[12px] flex items-center gap-1.5"
                    animate={{
                      backgroundColor: active ? "#6366f1" : "rgba(255,255,255,0.92)",
                      color: active ? "#ffffff" : undefined,
                    }}
                    transition={springSnappy}
                  >
                    <span>{cfg.icon}</span>
                    <span>{cfg.name}</span>
                    <span className="opacity-70">{count}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Apply sort + source filter to a project list. Keeps the original "relevance"
// order (the array comes pre-sorted by rankCorpus) by default.
export function applyResultsView(
  projects: UnifiedProject[],
  sortMode: SortMode,
  activeSource: SourceType | null,
): UnifiedProject[] {
  const filtered = activeSource
    ? projects.filter((p) => p.source === activeSource)
    : projects;

  if (sortMode === "relevance") return filtered;

  const copy = [...filtered];
  switch (sortMode) {
    case "stars":
      copy.sort((a, b) => (b.stars || 0) - (a.stars || 0));
      break;
    case "updated":
      copy.sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
      );
      break;
    case "downloads":
      copy.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
      break;
  }
  return copy;
}
