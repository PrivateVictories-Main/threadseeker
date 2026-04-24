// Shape-mirror skeleton for UnifiedProjectCard. The proportions match the
// real card (title + two description lines) so the grid doesn't reflow
// when results arrive.

import { Shimmer } from "./motion/Shimmer";

export function CardSkeleton() {
  return (
    <div className="ts-card glass skeleton">
      <Shimmer className="shimmer-title" />
      <Shimmer className="shimmer-line" />
      <Shimmer className="shimmer-line shimmer-short" />
    </div>
  );
}
