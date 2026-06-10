// frontend/src/lib/motion.ts
import type { Transition, Variants } from "framer-motion";

// Softer, more confident spring — reads as Apple-adjacent rather than jittery.
export const springSoft: Transition = { type: "spring", stiffness: 190, damping: 24, mass: 0.9 };
// Snappy — for UI chrome reacting to user input (toggle, filter flip).
export const springSnappy: Transition = { type: "spring", stiffness: 360, damping: 28 };
// Pill — the shared layoutId active-pill glide (sidebar nav, view toggle).
export const springPill: Transition = { type: "spring", stiffness: 380, damping: 32, mass: 0.7 };
// Bouncy — playful one-shots like the bookmark heart tap.
export const springBouncy: Transition = { type: "spring", stiffness: 320, damping: 18 };

// Overhaul D — slightly larger initial stagger window. 0.025s/child feels
// mechanical at 9 cards (~225ms total); 0.035 gives the first ~6 cards a
// deliberate "card-by-card" land and the rest catch up. delayChildren
// nudged to 0.06 so the grid breath happens after the parent fade-in
// is meaningfully visible.
// Stagger moved into the CARD variant (dynamic, clamped) — container-level
// staggerChildren can't cap, so 100 results trickled in for 3.5s on every
// list→grid toggle. Cards now delay min(index, 12) * 0.035: the first two
// rows land card-by-card, everything deeper arrives together.
export const gridContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delayChildren: 0.06 } },
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
  visible: (i: number = 0) => ({
    opacity: 1, y: 0, x: 0, scale: 1,
    transition: { ...springSoft, delay: Math.min(i, 12) * 0.035 },
  }),
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
  // Tween, not spring: a spring ignores duration/times, so the designed
  // "hold at 1.4 until 55%" choreography never ran. easeOut keeps the snap.
  tapped: { scale: [1, 1.4, 1], transition: { duration: 0.45, times: [0, 0.55, 1], ease: "easeOut" } },
};

// List-row entrance: a dynamic variant, because a variant's own transition
// overrides any `transition` prop on the component — the previous attempt
// passed the stagger delay as a prop and it silently never ran (all rows
// sprang in simultaneously). `custom={index}` feeds the delay; modulo keeps
// long lists from trickling forever.
export const listRowVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.995 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0, x: 0, scale: 1,
    transition: { ...springSoft, delay: (i % 12) * 0.022 },
  }),
  exit: { opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.16 } },
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
// The hero↔results handoff is the product's signature moment — the instant
// the user's search "pushes through" the landing. It must be a CROSSFADE
// (AnimatePresence mode="popLayout" pops the exiting section out of flow so
// the incoming one paints immediately): the old mode="wait" serialized a
// 0.32s hero exit before results could even mount, leaving the primary
// action staring at a blank backdrop. Exit is fast and recessive (slight
// scale-down + soft blur = the hero falls away behind the glass); enter is
// a confident rise with the skeleton grid already shimmering.
export const modeVariants: Variants = {
  heroEnter: { opacity: 0, y: 12 },
  // transitionEnd clears the filter so the section doesn't carry a permanent
  // inline blur(0px) (it forces a compositing layer for nothing).
  heroShow:  { opacity: 1, y: 0, scale: 1, transition: springSoft, transitionEnd: { filter: "none" } },
  heroExit:  {
    opacity: 0, scale: 0.985, filter: "blur(5px)",
    transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
  },
  resultsEnter: { opacity: 0, y: 14 },
  // Duration-form spring (stiffness-form springs silently IGNORE duration).
  resultsShow:  { opacity: 1, y: 0, transition: { type: "spring", duration: 0.34, bounce: 0.16 }, transitionEnd: { filter: "none" } },
  resultsExit:  {
    opacity: 0, scale: 0.99, filter: "blur(4px)",
    transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] },
  },
};

// MotionConfig reducedMotion="user" strips TRANSFORM and layout animations
// but filter (like opacity) keeps animating — so reduced-motion users need
// a variants set with no blur at all, not just smaller motion.
export const modeVariantsReduced: Variants = {
  heroEnter: { opacity: 0 },
  heroShow:  { opacity: 1, transition: { duration: 0.2 } },
  heroExit:  { opacity: 0, transition: { duration: 0.15 } },
  resultsEnter: { opacity: 0 },
  resultsShow:  { opacity: 1, transition: { duration: 0.2 } },
  resultsExit:  { opacity: 0, transition: { duration: 0.15 } },
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

// Iter-21 / Overhaul G — right-side slide-in drawer (DetailDrawer).
// Drawer mounts off-screen at x: 100% and slides to x: 0; backdrop fades
// concurrently. Spotify macOS / Apple-adjacent springSoft so the surface
// reads as confidently arriving rather than zipping in.
export const drawerSurface: Variants = {
  hidden:  { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { ...springSoft, mass: 0.85 } },
  exit:    { x: "100%", opacity: 0, transition: { duration: 0.26, ease: [0.32, 0.72, 0, 1] } },
};
