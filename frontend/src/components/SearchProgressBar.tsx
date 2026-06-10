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
      {/* The progress bar IS the thread: the same luminous strand from the
          hero, now traveling the top of the viewport as sources return. The
          glow head (::after) rides the leading edge. */}
      <div className="ts-search-thread fixed top-0 left-0 right-0 z-50 pointer-events-none" aria-hidden>
        <div className="ts-search-thread-fill" style={{ width: `${pct}%` }} />
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
