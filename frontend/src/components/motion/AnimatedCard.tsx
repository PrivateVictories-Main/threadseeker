"use client";

import { motion } from "framer-motion";
import { cardVariants } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function AnimatedCard({
  children,
  layoutId,
}: {
  children: React.ReactNode;
  layoutId?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      layoutId={layoutId}
      variants={reduced ? {} : cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={reduced ? undefined : "hover"}
      whileTap={reduced ? undefined : "tap"}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
