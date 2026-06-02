"use client";

import { useState } from "react";
import type { SourceType } from "@/lib/sources/types";
import { getBrandMark } from "@/lib/sources/brand-icons";
import { getSourceConfig } from "@/lib/sources";

// The card "cover" — every project gets a rich showcase header, not just a
// text block:
//   • GitHub repos    → the real Open Graph social banner (logo + live
//                       contributor/star/fork stats), the same image shared
//                       links unfurl. Lazy + self-healing: a 404/rate-limit
//                       falls back to the branded cover below.
//   • everything else → a branded cover built from the source's own vendor
//                       color + a large watermark of its real logo (or its
//                       lucide glyph when no brand mark exists), with the
//                       primary language called out.
export function CardMedia({
  source,
  fullName,
  language,
}: {
  source: SourceType;
  fullName: string;
  language?: string | null;
}) {
  const [ogFailed, setOgFailed] = useState(false);
  const brand = getBrandMark(source);
  const showOg = source === "github" && fullName.includes("/") && !ogFailed;

  if (showOg) {
    return (
      <div className="ts-card-media" aria-hidden>
        <img
          src={`https://opengraph.githubassets.com/1/${fullName}`}
          alt=""
          loading="lazy"
          decoding="async"
          width={1280}
          height={640}
          onError={() => setOgFailed(true)}
        />
        <span className="ts-card-media-fade" />
      </div>
    );
  }

  // Branded cover. Expose BOTH the light brand hex and the dark-mode override
  // (mirrors SourceMark) so near-black brands don't wash out on dark glass.
  const color = brand?.hex ?? "var(--ts-accent)";
  const darkColor = brand?.darkHex ?? brand?.hex ?? "var(--ts-accent-strong, var(--ts-accent))";
  // No brand mark (e.g. Open VSX) → fall back to the source's lucide glyph so
  // the tile still carries a recognizable silhouette instead of rendering empty.
  const FallbackGlyph = brand ? null : getSourceConfig(source).lucideIcon;

  return (
    <div
      className="ts-card-media ts-card-media-brand"
      data-source={source}
      style={{ ["--brand" as string]: color, ["--brand-dark" as string]: darkColor }}
      aria-hidden
    >
      {brand ? (
        <svg
          className="ts-card-media-watermark"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={brand.path} />
        </svg>
      ) : FallbackGlyph ? (
        <FallbackGlyph className="ts-card-media-watermark-icon" />
      ) : null}
      <span className="ts-card-media-lang">{language || getSourceConfig(source).name}</span>
      <span className="ts-card-media-fade" />
    </div>
  );
}
