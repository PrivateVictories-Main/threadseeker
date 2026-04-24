"use client";

import { motion } from "framer-motion";
import { cardVariants } from "@/lib/motion";

// Reduced-motion handling is delegated to the global MotionConfig provider
// (`reducedMotion="user"` in MotionProvider). Framer auto-skips the
// transition portions of these variants when the OS pref is set, so the
// previous per-component `useReducedMotion` branch was redundant.
export function AnimatedCard({
  children,
  layoutId,
  index,
}: {
  children: React.ReactNode;
  layoutId?: string;
  /**
   * Position in the result grid. Drives a tiny per-card variation in the
   * entry offset (odd cards lift slightly higher / nudge left; even
   * cards stay at the baseline) so the staggered fade-in reads as alive
   * rather than mechanical. Reduced-motion users get a no-op via the
   * global MotionConfig, so the variation never reaches them.
   */
  index?: number;
}) {
  // Per-card hidden-state offset. Keeps the rhythm subtle: max ±4px on
  // y and ±2px on x; otherwise the pattern is loud. Even rows stay
  // flat; odd rows lift slightly higher with a small left nudge.
  const odd = (index ?? 0) % 2 === 1;
  const enterFrom = odd
    ? { opacity: 0, y: 12, x: -2 }
    : { opacity: 0, y: 8, x: 2 };

  return (
    <motion.div
      layoutId={layoutId}
      variants={cardVariants}
      initial={enterFrom}
      animate="visible"
      exit="exit"
      whileHover="hover"
      whileTap="tap"
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
