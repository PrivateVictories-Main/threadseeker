"use client";
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from "framer-motion";
import { useEffect } from "react";

// Framer's `useReducedMotion` honors the global <MotionConfig reducedMotion="user">
// provider; returns boolean | null (null means "still resolving") which we
// treat as "not reduced" so the count animates by default.
export function CountUp({ value, duration = 0.3 }: { value: number; duration?: number }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration });
    return () => controls.stop();
  }, [value, duration, reduced, mv]);
  return <motion.span>{rounded}</motion.span>;
}
