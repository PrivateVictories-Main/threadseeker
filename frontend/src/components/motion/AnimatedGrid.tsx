"use client";

import { forwardRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gridContainer } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface AnimatedGridProps {
  children: React.ReactNode;
  keyed: string;
  className?: string;
}

export const AnimatedGrid = forwardRef<HTMLDivElement, AnimatedGridProps>(
  function AnimatedGrid({ children, keyed, className }, ref) {
    const reduced = useReducedMotion();
    return (
      <AnimatePresence mode="popLayout">
        <motion.div
          ref={ref}
          key={keyed}
          variants={reduced ? {} : gridContainer}
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
