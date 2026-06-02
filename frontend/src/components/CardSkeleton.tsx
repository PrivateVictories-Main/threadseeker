// Shape-mirror skeleton for UnifiedProjectCard. Proportions and rhythm match
// the real card — source badge, avatar + title, description lines, metric
// grid, topics, footer, action buttons — so the grid doesn't reflow when
// results arrive.

import { Shimmer } from "./motion/Shimmer";

interface Props {
  /** When true, render the shorter sparse-card geometry (320px min-height,
   *  no description / no metric grid). Use when the active source set is
   *  dominated by sparse community sources. */
  sparse?: boolean;
}

export function CardSkeleton({ sparse = false }: Props = {}) {
  if (sparse) {
    return (
      <div className="ts-card ts-card-sparse glass skeleton">
        {/* Cover placeholder — mirrors the new card media zone so the grid
            doesn't reflow when the real cover/banner paints in. */}
        <Shimmer className="shimmer-cover" />
        <div className="flex items-center gap-2">
          <Shimmer className="shimmer-pill" />
          <Shimmer className="shimmer-pill ml-auto" style={{ width: "60px" }} />
        </div>
        <div className="flex items-center gap-3">
          <Shimmer className="shimmer-circle" style={{ width: "44px", height: "44px" }} />
          <div className="flex-1 flex flex-col gap-1.5">
            <Shimmer className="shimmer-title" style={{ height: "20px" }} />
            <Shimmer className="shimmer-sub" />
          </div>
        </div>
        <div className="flex gap-1.5 mt-auto">
          <Shimmer className="shimmer-line" style={{ height: "40px" }} />
          <Shimmer className="shimmer-pill" style={{ height: "40px", width: "30%" }} />
        </div>
      </div>
    );
  }
  return (
    <div className="ts-card glass skeleton">
      {/* Skeleton geometry mirrors the card: a cover banner up top, then badge
          row, avatar + title, description, a single stat row, topics, actions —
          so the grid doesn't reflow when real results paint in. */}
      <Shimmer className="shimmer-cover" />
      <div className="flex items-center gap-2">
        <Shimmer className="shimmer-pill" />
        <Shimmer className="shimmer-pill ml-auto" style={{ width: "70px" }} />
      </div>
      <div className="flex items-center gap-3">
        <Shimmer className="shimmer-circle" style={{ width: "44px", height: "44px" }} />
        <div className="flex-1 flex flex-col gap-1.5">
          <Shimmer className="shimmer-title" style={{ height: "20px" }} />
          <Shimmer className="shimmer-sub" />
        </div>
      </div>
      <Shimmer className="shimmer-line" />
      <Shimmer className="shimmer-line shimmer-short" />
      {/* Single stat row (matches the card's CardStatRow). */}
      <Shimmer className="shimmer-line" style={{ height: "18px", width: "88%" }} />
      <div className="flex gap-1.5">
        <Shimmer className="shimmer-pill" />
        <Shimmer className="shimmer-pill" />
        <Shimmer className="shimmer-pill" />
      </div>
      <div className="flex gap-1.5 mt-auto">
        <Shimmer className="shimmer-line" style={{ height: "40px" }} />
        <Shimmer className="shimmer-pill" style={{ height: "40px", width: "30%" }} />
      </div>
    </div>
  );
}
