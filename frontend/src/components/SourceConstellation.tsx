"use client";

// The signature hero centerpiece — a constellation of the 28 sources, each a
// brand-colored node, woven together by a single drifting "thread". It's the
// literal product metaphor (ThreadSeeker threads the open-source world into one
// view) and replaces the generic three-blurred-blobs hero backdrop.
//
// Deterministic phyllotaxis layout (golden angle) → an organic spread that's
// identical on server + client (no Math.random, so no hydration mismatch).
// Gentle CSS drift + a pointer-parallax wrapper give it life; both are disabled
// under prefers-reduced-motion.

import { useEffect, useRef } from "react";
import type { SourceType } from "@/lib/sources/types";
import { getBrandMark } from "@/lib/sources/brand-icons";

const GOLDEN_ANGLE = 2.399963229728653; // 137.5° in radians

interface NodePos {
  x: number;
  y: number;
  r: number;
  delay: number;
  dur: number;
}

// Computed once at module load — deterministic.
function layout(n: number): NodePos[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = i * GOLDEN_ANGLE;
    const radius = Math.sqrt((i + 0.6) / n); // 0..1, denser near center
    return {
      x: 50 + Math.cos(angle) * radius * 47,
      y: 50 + Math.sin(angle) * radius * 43,
      r: 2.2 + ((i * 7) % 5) * 0.55,
      delay: -((i % 9) * 0.7),
      dur: 7 + ((i * 13) % 6),
    };
  });
}

export function SourceConstellation({ sources }: { sources: SourceType[] }) {
  const nodes = layout(sources.length);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Pointer parallax — translate the layer a few px toward the cursor. rAF-
  // throttled, no-op for touch / reduced-motion (the media query short-circuits).
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
        const px = (e.clientX / w - 0.5) * 2; // -1..1
        const py = (e.clientY / h - 0.5) * 2;
        el.style.setProperty("--cx", px.toFixed(3));
        el.style.setProperty("--cy", py.toFixed(3));
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Thread path through the nodes, in spiral order.
  const thread = nodes.map((nd, i) => `${i === 0 ? "M" : "L"}${nd.x.toFixed(2)},${nd.y.toFixed(2)}`).join(" ");

  return (
    <div className="ts-constellation" aria-hidden ref={wrapRef}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="ts-constellation-svg">
        {/* The woven thread. */}
        <path d={thread} className="ts-constellation-thread" fill="none" />
        {/* Brand-colored source nodes. */}
        {nodes.map((nd, i) => {
          const brand = getBrandMark(sources[i]);
          const color = brand?.hex ?? "#6366f1";
          return (
            <circle
              key={sources[i]}
              cx={nd.x}
              cy={nd.y}
              r={nd.r}
              fill={color}
              className="ts-constellation-node"
              style={{
                animationDelay: `${nd.delay}s`,
                animationDuration: `${nd.dur}s`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
