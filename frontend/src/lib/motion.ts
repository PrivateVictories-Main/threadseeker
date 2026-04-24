// frontend/src/lib/motion.ts
import type { Transition, Variants } from "framer-motion";

export const springSoft: Transition = { type: "spring", stiffness: 280, damping: 28, mass: 0.8 };
export const springSnappy: Transition = { type: "spring", stiffness: 500, damping: 35 };

export const gridContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: springSoft },
  exit:    { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18 } },
  hover:   { y: -3, transition: { duration: 0.18 } },
  tap:     { scale: 0.98, transition: { duration: 0.1 } },
};

export const bookmarkVariants: Variants = {
  rest:   { scale: 1 },
  tapped: { scale: [1, 1.35, 1], transition: { duration: 0.4, times: [0, 0.6, 1] } },
};

export const sheetVariants: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: springSoft },
  exit:    { opacity: 0, y: 20, transition: { duration: 0.2 } },
};
