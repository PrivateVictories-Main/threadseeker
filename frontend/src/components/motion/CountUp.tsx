"use client";
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

// Framer's `useReducedMotion` honors the global <MotionConfig reducedMotion="user">
// provider; returns boolean | null (null means "still resolving") which we
// treat as "not reduced" so the count animates by default.
//
// When values change faster than RAPID_THRESHOLD_MS (i.e. results
// streaming in faster than the count can animate), the next update
// snaps to the new value instead of starting another tween. This
// prevents the count from feeling perpetually behind during a fast
// stream and keeps the on-screen number in sync with reality.
const RAPID_THRESHOLD_MS = 100;

export function CountUp({ value, duration = 0.3 }: { value: number; duration?: number }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  const lastChangeAtRef = useRef<number>(0);
  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastChangeAtRef.current;
    lastChangeAtRef.current = now;
    if (reduced || elapsed < RAPID_THRESHOLD_MS) {
      // Reduced-motion: never tween. Rapid-change: skip to current
      // value so the displayed number doesn't lag a fast stream of
      // updates — the next slow update will animate again as normal.
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration });
    return () => controls.stop();
  }, [value, duration, reduced, mv]);
  return <motion.span>{rounded}</motion.span>;
}
