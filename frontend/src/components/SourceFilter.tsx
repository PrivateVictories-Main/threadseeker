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
    <div className="glass-strong source-filter-sheet flex flex-wrap justify-center gap-1.5">
      {allSources.map((source) => {
        const config = getSourceConfig(source);
        const active = selectedSources.includes(source);
        return (
          <button
            key={source}
            onClick={() => onToggle(source)}
            data-active={String(active)}
            className="filter-pill pill text-xs flex items-center gap-1"
          >
            <span className="text-[11px]">{config.icon}</span>
            <span>{config.name}</span>
          </button>
        );
      })}
    </div>
  );
}
