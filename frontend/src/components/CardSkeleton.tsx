// Shape-mirror skeleton for UnifiedProjectCard. The proportions match the
// real card (avatar + two-line header + two description lines + stats
// pill row + action bar) so the grid doesn't reflow when results arrive.

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800/50 bg-slate-950/40 overflow-hidden animate-pulse">
      <div className="p-4 pb-0 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-800/60 flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <div className="h-3 w-3/5 rounded bg-slate-800/70" />
          <div className="h-2 w-1/3 rounded bg-slate-800/50" />
        </div>
      </div>
      <div className="px-4 pt-3 pb-3 space-y-1.5">
        <div className="h-2.5 w-full rounded bg-slate-900/60" />
        <div className="h-2.5 w-4/5 rounded bg-slate-900/60" />
      </div>
      <div className="px-4 pb-3 flex items-center gap-3">
        <div className="h-2 w-10 rounded bg-slate-900/70" />
        <div className="h-2 w-14 rounded bg-slate-900/70" />
        <div className="h-2 w-8 rounded bg-slate-900/70 ml-auto" />
      </div>
      <div className="border-t border-slate-800/40 p-3">
        <div className="h-8 w-full rounded-lg bg-slate-900/50" />
      </div>
    </div>
  );
}
