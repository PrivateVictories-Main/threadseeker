"use client";

import { forwardRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gridContainer } from "@/lib/motion";

interface AnimatedGridProps {
  children: React.ReactNode;
  keyed: string;
  className?: string;
}

// Two layers of AnimatePresence so two distinct events both animate:
//
//   1. Outer AnimatePresence (`mode="wait"`, keyed wrapper) handles the
//      whole-grid swap when `keyed` changes (new query) — the existing
//      grid exits, the new grid enters.
//   2. Inner AnimatePresence (`mode="popLayout"`, no key on its
//      wrapper) handles per-card mount/unmount within a stable grid —
//      i.e. when source filters toggle on/off and individual cards
//      appear/disappear without the grid itself re-keying.
//
// Before this restructure, only event (1) animated — filter changes
// snapped cards in/out because AnimatePresence only tracks mount/unmount
// of its *direct* children, and the cards were grandchildren of the
// outer keyed `motion.div`. Now AnimatedCard's exit variant fires
// whenever a card leaves the view (filter toggle, sort dedupe, etc.).
//
// Reduced-motion handling is delegated to the global MotionConfig
// provider (`reducedMotion="user"` in MotionProvider) — framer auto-
// skips the variant transitions under the OS pref.
export const AnimatedGrid = forwardRef<HTMLDivElement, AnimatedGridProps>(
  function AnimatedGrid({ children, keyed, className }, ref) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          ref={ref}
          key={keyed}
          variants={gridContainer}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={className}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {children}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    );
  },
);
