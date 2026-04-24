// Shape-mirror skeleton for UnifiedProjectCard. Proportions and rhythm match
// the real card — source badge, avatar + title, description lines, pills —
// so the grid doesn't reflow when results arrive.

import { Shimmer } from "./motion/Shimmer";

interface Props {
  /** When true, render the shorter sparse-card geometry (260px min-height,
   *  no description lines). Use when the active source set is dominated
   *  by community sources (reddit / hackernews / lobsters / devto) where
   *  the real cards arrive without description + topics and render in the
   *  ts-card-sparse 260px shell. */
  sparse?: boolean;
}

export function CardSkeleton({ sparse = false }: Props = {}) {
  if (sparse) {
    return (
      <div className="ts-card ts-card-sparse glass skeleton">
        <div className="flex items-center gap-2">
          <Shimmer className="shimmer-pill" />
        </div>
        <div className="flex items-center gap-3">
          <Shimmer className="shimmer-circle" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Shimmer className="shimmer-title" />
            <Shimmer className="shimmer-sub" />
          </div>
        </div>
        <div className="flex gap-1.5 mt-auto">
          <Shimmer className="shimmer-pill" />
          <Shimmer className="shimmer-pill" />
        </div>
      </div>
    );
  }
  return (
    <div className="ts-card glass skeleton">
      <div className="flex items-center gap-2">
        <Shimmer className="shimmer-pill" />
      </div>
      <div className="flex items-center gap-3">
        <Shimmer className="shimmer-circle" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Shimmer className="shimmer-title" />
          <Shimmer className="shimmer-sub" />
        </div>
      </div>
      <Shimmer className="shimmer-line" />
      <Shimmer className="shimmer-line shimmer-short" />
      <div className="flex gap-1.5 mt-auto">
        <Shimmer className="shimmer-pill" />
        <Shimmer className="shimmer-pill" />
        <Shimmer className="shimmer-pill" />
      </div>
    </div>
  );
}
