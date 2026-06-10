"use client";

// The hero backdrop — a calm, premium "constellation" of the REAL platforms
// ThreadSeeker weaves together, framed around the headline rather than crowding
// it. A few recognizable brand logos sit as glassy floating chips, linked by a
// single luminous "thread" (the literal product metaphor) that drifts over a
// soft aurora. Deliberately low-contrast + slow: a backdrop, not a distraction.
// All motion is disabled under prefers-reduced-motion.

import { useEffect, useRef } from "react";
import type { SourceType } from "@/lib/sources/types";
import { SourceMark } from "./card/SourceMark";

// Hand-placed around the PERIMETER so the thread frames the centered headline +
// search instead of running behind the text. Placed only in the TOP strip, the
// RIGHT side, and the bottom-RIGHT — the headline / tagline / search / example
// chips all live in the left column, so the constellation frames the content
// instead of colliding with the text. Order = the thread's weave path (across
// the top, down the right, along the bottom-right).
//
// The 9 slot positions are hand-tuned and frozen; only the BRANDS filling them
// are curated — a STATIC pick from the current 40-source roster, chosen for
// recognizability + color diversity along the weave (red → green → orange →
// white → yellow → purple → blue → orange-red → light blue). Static on purpose:
// this renders on the server, so any randomness would risk hydration mismatch.
const NODES: Array<{ source: SourceType; x: number; y: number; s: number; delay: number }> = [
  { source: "npm", x: 40, y: 10, s: 0.86, delay: 0.6 },
  { source: "modrinth", x: 60, y: 8, s: 0.76, delay: 1.8 },
  { source: "crates", x: 76, y: 13, s: 0.82, delay: 0.3 },
  { source: "github", x: 91, y: 27, s: 1.0, delay: 1.3 },
  { source: "huggingface", x: 85, y: 49, s: 0.86, delay: 0 },
  { source: "terraform", x: 93, y: 64, s: 0.78, delay: 2.1 },
  { source: "dockerhub", x: 85, y: 79, s: 0.9, delay: 2.4 },
  { source: "reddit", x: 72, y: 90, s: 0.82, delay: 1.0 },
  { source: "pypi", x: 55, y: 90, s: 0.74, delay: 1.5 },
];

const THREAD = "M" + NODES.map((n) => `${n.x},${n.y}`).join(" L ");

export function SourceConstellation() {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Gentle pointer parallax — rAF-throttled; no-op for touch / reduced-motion.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (typeof window !== "undefined") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
      if (reduce.matches || !fine.matches) return;
    }
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        el.style.setProperty("--cx", ((e.clientX / w - 0.5) * 2).toFixed(3));
        el.style.setProperty("--cy", ((e.clientY / h - 0.5) * 2).toFixed(3));
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="ts-constellation" aria-hidden ref={wrapRef}>
      <div className="ts-hero-aurora" />
      <svg
        className="ts-hero-thread-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ts-thread-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--ts-accent-rgb))" stopOpacity="0.0" />
            <stop offset="50%" stopColor="rgb(var(--ts-accent-rgb))" stopOpacity="0.55" />
            <stop offset="100%" stopColor="rgb(var(--ts-accent-rgb))" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* faint full thread */}
        <path
          d={THREAD}
          className="ts-hero-thread"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
        {/* luminous pulse that travels along it */}
        <path
          d={THREAD}
          className="ts-hero-thread-pulse"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {NODES.map((n) => (
        <span
          key={n.source}
          className="ts-hero-node"
          data-source={n.source}
          style={
            {
              left: `${n.x}%`,
              top: `${n.y}%`,
              ["--s"]: n.s,
              animationDelay: `${n.delay}s`,
            } as React.CSSProperties
          }
        >
          <SourceMark source={n.source} className="ts-hero-node-mark" />
        </span>
      ))}
    </div>
  );
}
