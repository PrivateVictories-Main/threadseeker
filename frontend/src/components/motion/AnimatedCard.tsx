"use client";

import { motion } from "framer-motion";
import { cardVariants } from "@/lib/motion";

// Reduced-motion handling is delegated to the global MotionConfig provider
// (`reducedMotion="user"` in MotionProvider). Framer auto-skips the
// transition portions of these variants when the OS pref is set, so the
// previous per-component `useReducedMotion` branch was redundant.

// Soft cap on FLIP layout animation. `layout="position"` runs FLIP per
// card on every layout-affecting state change — measure-then-animate.
// At 9-12 cards it's smooth; at 60+ the simultaneous animate gets
// expensive, especially on lower-powered phones. Cards beyond this
// index skip layout entirely (still animate entry/exit, still pair
// across hero→results via layoutId, but sort reorder snaps instead of
// sliding). 60 was chosen as the threshold because two screen-fulls of
// cards (≈3 cols × 4 rows × 2 viewports + buffer) is the upper bound
// where the slide still reads as informative; past that the wave
// becomes visual noise.
const LAYOUT_CAP = 60;

export function AnimatedCard({
  children,
  layoutId,
  index,
  className,
  resultId,
  resultUrl,
}: {
  children: React.ReactNode;
  layoutId?: string;
  /**
   * Position in the result grid. Drives a tiny per-card variation in the
   * entry offset (odd cards lift slightly higher / nudge left; even
   * cards stay at the baseline) so the staggered fade-in reads as alive
   * rather than mechanical. Also gates FLIP layout animation: only the
   * first LAYOUT_CAP cards animate sort reorders to keep the per-frame
   * measure-and-animate cost bounded on huge result sets. Reduced-motion
   * users get a no-op via the global MotionConfig, so the variation
   * never reaches them.
   */
  index?: number;
  /**
   * Extra classes merged onto the motion.div — used by the page-level
   * grid to paint a focus-ring when the card is keyboard-focused. Hoisted
   * here (instead of a wrapping motion.div in page.tsx) so each card has
   * exactly one motion layer instead of two — every motion node carries
   * a mount/unmount cost from AnimatePresence's tracking. The wrapper-
   * vs-AnimatedCard split was concerns-separated but motion-cost-double.
   */
  className?: string;
  /**
   * Optional data attributes for the keyboard-navigation harness in
   * page.tsx (data-result-card / data-result-id / data-result-url). Pass
   * the project id + url; the component stamps the data-result-card
   * sentinel automatically when either is provided.
   */
  resultId?: string;
  resultUrl?: string;
}) {
  // Per-card hidden-state offset. Keeps the rhythm subtle: max ±4px on
  // y and ±2px on x; otherwise the pattern is loud. Even rows stay
  // flat; odd rows lift slightly higher with a small left nudge.
  const odd = (index ?? 0) % 2 === 1;
  const enterFrom = odd
    ? { opacity: 0, y: 12, x: -2 }
    : { opacity: 0, y: 8, x: 2 };

  // Cards past the cap opt out of `layout="position"` to skip the FLIP
  // measure-and-animate cycle. They still get layoutId for the
  // hero→results shared-element transition (cheap; only fires on mount
  // pairing) and entry/exit animations.
  const enableLayout = (index ?? 0) < LAYOUT_CAP;

  // Compose className: keep the h-full anchor + layered focus-ring
  // styling from the caller.
  const composedClassName = className ? `h-full ${className}` : "h-full";
  const isResult = !!(resultId || resultUrl);

  return (
    <motion.div
      // layout="position" enables FLIP for sort-change re-ordering but
      // keeps width/height static — cards slide between grid cells
      // smoothly without animating their box dimensions (which would
      // squash content with different heights). layoutId still pairs
      // identical projects across hero→results transitions.
      layout={enableLayout ? "position" : false}
      layoutId={layoutId}
      variants={cardVariants}
      custom={index ?? 0}
      initial={enterFrom}
      animate="visible"
      exit="exit"
      whileHover="hover"
      whileTap="tap"
      transition={{ layout: { duration: 0.3, ease: [0.32, 0.72, 0, 1] } }}
      className={composedClassName}
      data-result-card={isResult ? "" : undefined}
      data-result-id={resultId}
      data-result-url={resultUrl}
    >
      {children}
    </motion.div>
  );
}
