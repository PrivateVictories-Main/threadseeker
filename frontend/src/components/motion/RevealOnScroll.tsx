"use client";

// Iter-24 / Major Overhaul J — section reveal-on-scroll wrapper.
//
// Wraps a landing-feed row in a `whileInView` framer-motion fade-up so
// sections gently emerge as they enter the viewport. `once: true`
// fires the animation a single time so it doesn't re-trigger on
// scroll-up. `margin: "-80px"` pre-fires the animation when the row's
// top edge is still 80px below the visible area, so by the time the
// row is fully scrolled in, it's already settled — feels organic
// rather than "popping in late".
//
// Reduced-motion users: framer's MotionConfig reducedMotion="user"
// collapses the variants automatically. No CSS branching needed.

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { springSoft } from "@/lib/motion";

interface Props {
  children: ReactNode;
  /** Optional className passed to the wrapper. */
  className?: string;
  /** Stagger this child's reveal by N seconds — used inside rows that
   *  fan out their own children sequentially (e.g. the stat tiles row
   *  uses 0, 0.06, 0.12 …). Default: 0. */
  delay?: number;
  /** Override the default y-translate distance. Defaults to 14px. */
  y?: number;
}

export function RevealOnScroll({
  children,
  className,
  delay = 0,
  y = 14,
}: Props) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{
        opacity: 1,
        y: 0,
        transition: { ...springSoft, delay },
      }}
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}
