// frontend/src/lib/motion.ts
import type { Transition, Variants } from "framer-motion";

// Softer, more confident spring — reads as Apple-adjacent rather than jittery.
export const springSoft: Transition = { type: "spring", stiffness: 190, damping: 24, mass: 0.9 };
// Snappy — for UI chrome reacting to user input (toggle, filter flip).
export const springSnappy: Transition = { type: "spring", stiffness: 360, damping: 28 };
// Bouncy — playful one-shots like the bookmark heart tap.
export const springBouncy: Transition = { type: "spring", stiffness: 320, damping: 18 };

// Overhaul D — slightly larger initial stagger window. 0.025s/child feels
// mechanical at 9 cards (~225ms total); 0.035 gives the first ~6 cards a
// deliberate "card-by-card" land and the rest catch up. delayChildren
// nudged to 0.06 so the grid breath happens after the parent fade-in
// is meaningfully visible.
export const gridContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.06 } },
};

export const cardVariants: Variants = {
  // Overhaul D — adds scale 0.985 to the hidden state so cards land with
  // a tiny "settle in" rather than a flat translate. Stays inside the
  // <2% budget so reduced-motion users still see no perceptible motion
  // (framer collapses transitions under the provider).
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  // x: 0 + scale: 1 in `visible` is required so per-card variations in
  // the `initial` prop (AnimatedCard's odd/even tilt) animate back to
  // the same resting offset.
  visible: { opacity: 1, y: 0, x: 0, scale: 1, transition: springSoft },
  // exit scale 0.94 (was 0.98 / page-wrapper 0.96) so the filter-toggle
  // collapse reads as a deliberate "card leaves the set" rather than a
  // gentle ghost.
  exit:    { opacity: 0, y: -8, scale: 0.94, transition: { duration: 0.18 } },
  // Overhaul D — hover is gated by CSS (translateY -6 on .ts-card:hover)
  // for instant tactile response without a frame of motion latency.
  // The variant stays as a no-op so framer's whileHover still fires the
  // children variants (badge / dot scale boosts) but doesn't fight the
  // CSS transform.
  hover:   { transition: springSoft },
  tap:     { scale: 0.985, transition: { duration: 0.1 } },
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

// Hero <-> Results mode crossfade. Overhaul D — hero "floats up" with a
// larger y-translate so the dismiss reads as content lifting off, and
// results land with a slightly larger entry slide so they read as
// arriving from below. Both still use the standard cubic-bezier ease-out
// so they share the rhythm with the intent-hue body transition.
//
// Timing: with AnimatePresence mode="wait" hero must fully exit before
// results enter. Hero exit at 0.32s (was 0.22) feels more deliberate and
// gives the user time to register what's happening. Results enter
// continues to use springSoft.
export const modeVariants: Variants = {
  heroEnter: { opacity: 0, y: 12 },
  heroShow:  { opacity: 1, y: 0, transition: springSoft },
  heroExit:  { opacity: 0, y: -32, transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] } },
  resultsEnter: { opacity: 0, y: 24 },
  resultsShow:  { opacity: 1, y: 0, transition: { ...springSoft, duration: 0.42 } },
  resultsExit:  { opacity: 0, y: 12, transition: { duration: 0.2 } },
};

// Overhaul D — modal/palette open variants. Used by CommandPalette and
// any future modal so they share the same motion vocabulary. Backdrop
// fades; modal scales 0.92→1 with springSoft + slight upward drift.
export const modalBackdrop: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] } },
  exit:    { opacity: 0, transition: { duration: 0.14, ease: [0.32, 0.72, 0, 1] } },
};
export const modalSurface: Variants = {
  hidden:  { opacity: 0, scale: 0.92, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springSoft },
  exit:    { opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.16 } },
};
