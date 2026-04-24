"use client";
import { useReducedMotion } from "framer-motion";

// Framer's `useReducedMotion` honors the global <MotionConfig reducedMotion="user">
// provider — same source of truth as every other motion component in the tree.
// Returns `boolean | null` (null while it figures out the OS pref); we treat
// null as "not reduced" so the shimmer animates by default.
export function Shimmer({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  return <div className={`shimmer ${reduced ? "shimmer-static" : ""} ${className}`} />;
}
