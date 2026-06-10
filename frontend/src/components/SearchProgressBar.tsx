"use client";

// The luminous search thread at the top of the viewport: width = how many of
// the fan-out's sources have returned; the glow head rides the leading edge.
// On completion the thread fills to 100% and fades, rather than vanishing
// mid-flight.

import { AnimatePresence, motion } from "framer-motion";
import { CountUp } from "./motion/CountUp";

interface Props {
  total: number;
  remaining: number;
  active: boolean;
}

export function SearchProgressBar({ total, remaining, active }: Props) {
  const done = Math.max(0, total - remaining);
  const pct = active ? Math.min(100, Math.max(2, (done / total) * 100)) : 100;
  return (
    <AnimatePresence>
      {active && total > 0 && (
        <motion.div
          key="search-thread"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, delay: 0.15 } }}
        >
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
