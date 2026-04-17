"use client";

import { UnifiedProject, SourceType, getSourceConfig } from "@/lib/sources";
import { ArrowDownWideNarrow, Link2, Check, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => onSourceClick(null)}
          className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors ${
            activeSource === null
              ? "border-slate-600 bg-slate-800/60 text-slate-200"
              : "border-slate-800/50 bg-slate-900/40 text-slate-500 hover:text-slate-300 hover:border-slate-700/60"
          }`}
        >
          All {projects.length}
        </button>
        {orderedSources.map(([source, count]) => {
          const cfg = getSourceConfig(source);
          const active = activeSource === source;
          return (
            <button
              key={source}
              onClick={() => onSourceClick(active ? null : source)}
              className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors flex items-center gap-1.5 ${
                active
                  ? "border-slate-600 bg-slate-800/60 text-slate-200"
                  : "border-slate-800/50 bg-slate-900/40 text-slate-500 hover:text-slate-300 hover:border-slate-700/60"
              }`}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.name}</span>
              <span className="text-slate-600">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center border border-slate-800/50 rounded-md overflow-hidden">
          <button
            onClick={() => handleExport("md")}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-800/60 px-2 py-1 transition-colors"
            title="Copy results as Markdown"
          >
            {exportedAs === "md" ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            <span>MD</span>
          </button>
          <button
            onClick={() => handleExport("json")}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-800/60 px-2 py-1 transition-colors border-l border-slate-800/50"
            title="Copy results as JSON"
          >
            {exportedAs === "json" ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            <span>JSON</span>
          </button>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-200 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/50 hover:border-slate-700/60 rounded-md px-2 py-1 transition-colors"
          title="Copy link to these results"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Link2 className="w-3 h-3" />
              <span>Share</span>
            </>
          )}
        </button>
        <ArrowDownWideNarrow className="w-3 h-3 text-slate-600" />
        <select
          value={sortMode}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          className="text-[11px] bg-slate-900/40 border border-slate-800/50 rounded-md px-2 py-1 text-slate-400 hover:text-slate-200 focus:outline-none focus:border-slate-700"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-slate-900">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// Apply sort + source filter to a project list. Keeps the original "relevance"
// order (the array comes pre-sorted by calculateRelevanceScore) by default.
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
