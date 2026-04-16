"use client";

import { SourceType, getSourceConfig } from "@/lib/sources";

interface SourceFilterProps {
  allSources: SourceType[];
  selectedSources: SourceType[];
  onToggle: (source: SourceType) => void;
}

export function SourceFilter({
  allSources,
  selectedSources,
  onToggle,
}: SourceFilterProps) {
  const allSelected = selectedSources.length === allSources.length;

  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {allSources.map((source) => {
        const config = getSourceConfig(source);
        const active = selectedSources.includes(source);
        return (
          <button
            key={source}
            onClick={() => onToggle(source)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
              active
                ? "border-slate-600/60 bg-slate-800/60 text-slate-300"
                : "border-slate-800/40 bg-transparent text-slate-600 hover:text-slate-500 hover:border-slate-700/50"
            }`}
          >
            <span className="text-[11px]">{config.icon}</span>
            <span>{config.name}</span>
          </button>
        );
      })}
    </div>
  );
}
