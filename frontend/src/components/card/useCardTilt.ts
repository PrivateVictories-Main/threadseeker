"use client";

import { useCallback, useRef } from "react";

// Pointer-tracked 3D tilt + spotlight for result cards. Sets the transform
// inline (so it tracks the cursor responsively and overrides the CSS hover
// lift) with a fast transition during movement, then clears it on leave so the
// card eases back via the slower .ts-card CSS transition. Also sets --mx/--my
// for the radial spotlight. Gated to hover-capable, fine-pointer, non-reduced-
// motion devices — touch + reduced-motion get the plain CSS hover instead.
export function useCardTilt() {
  const ref = useRef<HTMLElement | null>(null);
  const rafRef = useRef(0);
  const enabledRef = useRef<boolean | null>(null);

  const enabled = () => {
    if (enabledRef.current === null) {
      enabledRef.current =
        typeof window !== "undefined" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return enabledRef.current;
  };

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!enabled()) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rx = (0.5 - py) * 6.5; // tilt up/down, max ~3.25°
      const ry = (px - 0.5) * 6.5; // tilt left/right
      el.style.transition = "transform 0.09s ease-out";
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px) scale(1.008)`;
      el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(rafRef.current);
    el.style.transition = ""; // revert to the .ts-card .35s settle
    el.style.transform = ""; // revert to CSS rest state
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
