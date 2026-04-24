// Shape-mirror skeleton for UnifiedProjectCard. The proportions match the
// real card (title + two description lines) so the grid doesn't reflow
// when results arrive.

export function CardSkeleton() {
  return (
    <div className="ts-card glass skeleton">
      <div className="shimmer shimmer-title" />
      <div className="shimmer shimmer-line" />
      <div className="shimmer shimmer-line shimmer-short" />
    </div>
  );
}
