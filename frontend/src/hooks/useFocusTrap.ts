"use client";

import { useEffect, useRef, type RefObject } from "react";

// Modal focus management, extracted from the (correct) AppShell mobile-sidebar
// trap so every overlay shares one implementation. While `active`:
//   • move focus into `ref` (first focusable, else the container itself),
//   • trap Tab / Shift+Tab within it,
//   • call `onEscape` on Esc,
//   • lock body scroll,
//   • restore focus to the previously-focused element on deactivate.
// Satisfies WCAG 2.4.3 (focus order) + 2.1.2 (no keyboard trap escape) + 4.1.2.
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void,
) {
  // Keep onEscape in a ref so an inline callback doesn't re-run the effect.
  const escRef = useRef(onEscape);
  escRef.current = onEscape;

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const root = ref.current;
    if (!root) return;

    const restore = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      root.setAttribute("tabindex", "-1");
      root.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        escRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) return;
      const a = f[0];
      const z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      restore?.focus?.();
    };
  }, [active, ref]);
}
