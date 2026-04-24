"use client";

// Thin fixed bar at the top of the viewport showing how many sources have
// returned out of the total pending set. Disappears once the search is done.

import { CountUp } from "./motion/CountUp";

interface Props {
  total: number;
  remaining: number;
  active: boolean;
}

export function SearchProgressBar({ total, remaining, active }: Props) {
  if (!active || total === 0) return null;
  const done = Math.max(0, total - remaining);
  const pct = Math.min(100, Math.max(2, (done / total) * 100));
  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-slate-900/40 pointer-events-none"
        aria-hidden
      >
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-amber-300 to-emerald-400 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className="fixed top-2 right-3 z-50 text-[10px] font-mono text-slate-500 pointer-events-none tabular-nums"
        aria-live="polite"
      >
        <CountUp value={done} /> / {total} sources
      </div>
    </>
  );
}
