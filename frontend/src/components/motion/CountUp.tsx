"use client";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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
