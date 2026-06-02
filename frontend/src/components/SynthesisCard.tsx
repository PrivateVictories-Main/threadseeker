"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

// The AI crown: a short, opinionated cross-source verdict above the results.
// Rendered only when the optional AI layer is active (a key is set) — when it's
// disabled / unavailable, `verdict` is null and `loading` is false, so the card
// simply doesn't render. Never blocks the results.
export function SynthesisCard({
  verdict,
  loading,
}: {
  verdict: string | null;
  loading: boolean;
}) {
  if (!loading && !verdict) return null;
  return (
    <motion.aside
      className="ts-synthesis glass"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      aria-label="AI verdict"
      // Live on the stable container so the verdict is announced when it
      // replaces the pending placeholder (previously aria-live was only on the
      // pending <p>, so the actual verdict — a different node — never announced).
      aria-live="polite"
    >
      <span className="ts-synthesis-head">
        <Sparkles className="w-3.5 h-3.5" aria-hidden />
        AI verdict
      </span>
      {loading && !verdict ? (
        <p className="ts-synthesis-text ts-synthesis-pending">
          Reading the top results<span className="ts-loading-dots" aria-hidden />
        </p>
      ) : (
        <p className="ts-synthesis-text">{verdict}</p>
      )}
    </motion.aside>
  );
}
