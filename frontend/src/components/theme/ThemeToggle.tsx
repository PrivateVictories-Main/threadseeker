"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

// Light/dark toggle. Defaults follow the system (set in the provider); this
// flips the explicit override. Guarded against hydration mismatch — resolvedTheme
// is undefined on the server, so we render a stable icon until mounted.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <motion.button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`ts-theme-toggle ${className}`}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      whileTap={{ scale: 0.92, rotate: -12 }}
      transition={{ type: "spring", stiffness: 360, damping: 22 }}
    >
      {/* Render Moon pre-mount (stable SSR markup); swap to Sun in dark. */}
      {isDark ? (
        <Sun className="w-4 h-4" aria-hidden />
      ) : (
        <Moon className="w-4 h-4" aria-hidden />
      )}
    </motion.button>
  );
}
