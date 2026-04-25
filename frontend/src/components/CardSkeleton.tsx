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
      {/* Iter-15: skeleton geometry mirrors the new info-density card. The
          metric-grid block is the most distinctive new element, so the
          skeleton seeds three equally-sized cells where the real grid will
          land. The avatar shimmer is sized to the new 44px circle. */}
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
      <Shimmer className="shimmer-line" />
      <Shimmer className="shimmer-line shimmer-short" />
      {/* Metric grid — three equal cells. */}
      <div className="grid grid-cols-3 gap-2.5 py-3 border-y border-indigo-100">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Shimmer className="shimmer-line" style={{ height: "10px", width: "60%" }} />
            <Shimmer className="shimmer-line" style={{ height: "16px", width: "70%" }} />
          </div>
        ))}
      </div>
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
