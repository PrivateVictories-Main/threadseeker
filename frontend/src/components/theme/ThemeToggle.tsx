"use client";

import { useEffect, useRef, useState } from "react";
import { springSnappy } from "@/lib/motion";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";

// The View Transitions API ships in Chrome 111+ / Safari 18+; type the
// progressive-enhancement probe instead of `any`.
type DocWithViewTransition = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

// Light/dark toggle. Defaults follow the system (set in the provider); this
// flips the explicit override. Guarded against hydration mismatch — resolvedTheme
// is undefined on the server, so we render a stable icon until mounted.
//
// The flip itself is a SIGNATURE micro-moment: where the browser supports the
// View Transitions API, the new theme washes across the page as a radial
// reveal expanding from the toggle button — the whole UI re-skins in one
// confident sweep instead of every surface snapping independently. Fully
// progressive: unsupported browsers and reduced-motion users get the plain
// instant flip.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  const flip = () => {
    const next = isDark ? "light" : "dark";
    const doc = document as DocWithViewTransition;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!doc.startViewTransition || reduced) {
      setTheme(next);
      return;
    }
    // Radial reveal from the button's center: clip-path on the NEW snapshot
    // grows from the click origin to cover the farthest viewport corner.
    const rect = btnRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 40;
    const y = rect ? rect.top + rect.height / 2 : 40;
    const r = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const transition = doc.startViewTransition(() => setTheme(next));
    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${r}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 480,
            easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        /* transition skipped (e.g. tab hidden) — theme still flipped */
      });
  };

  return (
    <motion.button
      ref={btnRef}
      type="button"
      onClick={flip}
      className={`ts-theme-toggle ${className}`}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      whileTap={{ scale: 0.92, rotate: -12 }}
      transition={springSnappy}
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
