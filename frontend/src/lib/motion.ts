// frontend/src/lib/motion.ts
import type { Transition, Variants } from "framer-motion";

// Softer, more confident spring — reads as Apple-adjacent rather than jittery.
export const springSoft: Transition = { type: "spring", stiffness: 190, damping: 24, mass: 0.9 };
// Snappy — for UI chrome reacting to user input (toggle, filter flip).
export const springSnappy: Transition = { type: "spring", stiffness: 360, damping: 28 };
// Bouncy — playful one-shots like the bookmark heart tap.
export const springBouncy: Transition = { type: "spring", stiffness: 320, damping: 18 };

export const gridContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.025, delayChildren: 0.05 } },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  // x: 0 in `visible` is required so per-card variations in the
  // `initial` prop (see AnimatedCard's odd/even tilt) animate back to
  // the same resting offset. Without it framer would only animate the
  // declared keys.
  visible: { opacity: 1, y: 0, x: 0, scale: 1, transition: springSoft },
  // exit scale 0.94 (was 0.98 / page-wrapper 0.96) so the filter-toggle
  // collapse reads as a deliberate "card leaves the set" rather than a
  // gentle ghost — at 0.96 the depart was nearly indistinguishable from
  // a small layout shift. 0.94 keeps it inside the "subtle" budget
  // (still under 6% scale delta) while landing the read.
  exit:    { opacity: 0, y: -8, scale: 0.94, transition: { duration: 0.18 } },
  hover:   { y: -4, transition: springSoft },
  tap:     { scale: 0.98, transition: { duration: 0.1 } },
};

export const bookmarkVariants: Variants = {
  rest:   { scale: 1 },
  tapped: { scale: [1, 1.4, 1], transition: { ...springBouncy, duration: 0.45, times: [0, 0.55, 1] } },
};

export const sheetVariants: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: springSoft },
  exit:    { opacity: 0, y: 20, transition: { duration: 0.2 } },
};

// Hero <-> Results mode crossfade. Hero collapses up and out; Results slides up
// and in, both springy-soft so the transition reads as a single motion.
//
// Timing: with AnimatePresence mode="wait" hero must fully exit before
// results enter, so the user-visible "blank moment" is heroExit duration
// + however long resultsEnter takes to register pixels. Tightened heroExit
// to 220ms (was 300ms) and shortened the y-translate from -40 to -24 so
// the hero leaves more directly. Net feel: pressing Enter on the search
// bar reads as ~250ms before results start filling in, not ~350ms.
export const modeVariants: Variants = {
  heroEnter: { opacity: 0, y: 12 },
  heroShow:  { opacity: 1, y: 0, transition: springSoft },
  heroExit:  { opacity: 0, y: -24, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } },
  resultsEnter: { opacity: 0, y: 16 },
  resultsShow:  { opacity: 1, y: 0, transition: springSoft },
  resultsExit:  { opacity: 0, y: 12, transition: { duration: 0.2 } },
};
