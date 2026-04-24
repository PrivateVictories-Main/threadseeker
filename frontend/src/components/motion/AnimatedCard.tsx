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
}: {
  children: React.ReactNode;
  layoutId?: string;
}) {
  return (
    <motion.div
      layoutId={layoutId}
      variants={cardVariants}
      initial="hidden"
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
