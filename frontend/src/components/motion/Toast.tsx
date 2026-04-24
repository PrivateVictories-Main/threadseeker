"use client";
import { AnimatePresence, motion } from "framer-motion";
import { sheetVariants } from "@/lib/motion";

export function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="glass-strong ts-toast-motion"
          variants={sheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          key={message}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
