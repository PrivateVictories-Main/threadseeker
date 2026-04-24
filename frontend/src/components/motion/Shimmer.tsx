"use client";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function Shimmer({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  return <div className={`shimmer ${reduced ? "shimmer-static" : ""} ${className}`} />;
}
