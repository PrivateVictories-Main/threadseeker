"use client";

import { forwardRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gridContainer } from "@/lib/motion";

interface AnimatedGridProps {
  children: React.ReactNode;
  keyed: string;
  className?: string;
}

// Reduced-motion handling is delegated to the global MotionConfig provider
// (`reducedMotion="user"` in MotionProvider) — framer auto-skips the
// stagger / fade / slide here under reduce-motion, so the previous
// per-component `useReducedMotion` branch was redundant.
export const AnimatedGrid = forwardRef<HTMLDivElement, AnimatedGridProps>(
  function AnimatedGrid({ children, keyed, className }, ref) {
    return (
      <AnimatePresence mode="popLayout">
        <motion.div
          ref={ref}
          key={keyed}
          variants={gridContainer}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={className}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  },
);
