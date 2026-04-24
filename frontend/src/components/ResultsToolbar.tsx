"use client";

import { UnifiedProject, SourceType, getSourceConfig } from "@/lib/sources";
import { ArrowDownWideNarrow, Link2, Check, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { springSnappy } from "@/lib/motion";

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
  // Group by source so exports stay organized.
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
      setTimeout(() => setExportedAs(null), 1600);
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
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* user cancelled or clipboard unavailable */
    }
  };
  // Count results per source.
  const counts = new Map<SourceType, number>();
  for (const p of projects) {
    counts.set(p.source, (counts.get(p.source) ?? 0) + 1);
  }
  // Sort source chips by descending count so the dominant source is first.
  const orderedSources = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="glass flex flex-wrap items-center gap-2 p-2">
      <div className="flex items-center gap-1.5 flex-wrap">
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

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleExport("md")}
            className="btn text-[12px]"
            title="Copy results as Markdown"
          >
            {exportedAs === "md" ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>MD</span>
          </button>
          <button
            onClick={() => handleExport("json")}
            className="btn text-[12px]"
            title="Copy results as JSON"
          >
            {exportedAs === "json" ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>JSON</span>
          </button>
        </div>
        <button
          onClick={handleShare}
          className="btn text-[12px]"
          title="Copy link to these results"
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
        </button>
        <ArrowDownWideNarrow className="w-3.5 h-3.5 text-slate-500" />
        <select
          value={sortMode}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          className="text-[12px] bg-white/80 border border-indigo-200 rounded-md px-2.5 py-1.5 text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
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
