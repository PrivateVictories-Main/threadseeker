"use client";

import { useState } from "react";
import type { SourceType } from "@/lib/sources/types";
import { getBrandMark } from "@/lib/sources/brand-icons";

// The card "cover" — every project gets a rich showcase header, not just a
// text block:
//   • GitHub repos    → the real Open Graph social banner (logo + live
//                       contributor/star/fork stats), the same image shared
//                       links unfurl. Lazy + self-healing: a 404/rate-limit
//                       falls back to the branded cover below.
//   • everything else → a branded cover built from the source's own vendor
//                       color + a large watermark of its real logo, with the
//                       primary language called out — so an npm / PyPI / crate
//                       card reads as "what is this" at a glance too.
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
          onError={() => setOgFailed(true)}
        />
        <span className="ts-card-media-fade" />
      </div>
    );
  }

  // Branded cover. brand?.hex is `#rrggbb`; fall back to the accent token.
  const color = brand?.hex ?? "var(--ts-accent)";
  return (
    <div
      className="ts-card-media ts-card-media-brand"
      data-source={source}
      style={{ ["--brand" as string]: color }}
      aria-hidden
    >
      {brand && (
        <svg
          className="ts-card-media-watermark"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={brand.path} />
        </svg>
      )}
      {language && <span className="ts-card-media-lang">{language}</span>}
      <span className="ts-card-media-fade" />
    </div>
  );
}
