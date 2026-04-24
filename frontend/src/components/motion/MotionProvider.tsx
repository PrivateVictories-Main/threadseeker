"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Single source of truth for framer-motion's reduced-motion behavior.
 *
 * `reducedMotion="user"` tells framer to honor the OS-level
 * `prefers-reduced-motion: reduce` media query for every motion component
 * inside the tree — so individual components don't each have to wire
 * `useReducedMotion` and branch on it. Decorative-only animations are
 * skipped automatically; layout/exit animations still run because they
 * carry meaning (a card actually leaving the grid is information).
 *
 * Hand-rolled CSS `@keyframes` (heroShimmer, skeleton shimmer) still
 * read the same media query in globals.css so the two layers agree.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
