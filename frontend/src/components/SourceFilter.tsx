"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SourceType, getSourceConfig } from "@/lib/sources";
import { sheetVariants } from "@/lib/motion";

interface SourceFilterProps {
  allSources: SourceType[];
  selectedSources: SourceType[];
  onToggle: (source: SourceType) => void;
  open?: boolean;
}

export function SourceFilter({
  allSources,
  selectedSources,
  onToggle,
  open = true,
}: SourceFilterProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="glass-strong source-filter-sheet flex flex-wrap justify-center gap-1.5"
          variants={sheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
