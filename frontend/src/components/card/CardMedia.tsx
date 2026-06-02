"use client";

import { useState } from "react";

// Repo social-preview image — GitHub's Open Graph card (the same 2:1 banner
// shown when a repo link is shared). Lazy-loaded and self-collapsing: if the
// source isn't GitHub, the name isn't owner/repo, or the image 404s/rate-limits,
// the whole zone renders nothing so a card never shows a broken frame. The
// leading path segment is a cache-buster GitHub ignores.
export function CardMedia({
  fullName,
  source,
}: {
  fullName: string;
  source: string;
}) {
  const [failed, setFailed] = useState(false);
  if (source !== "github" || !fullName.includes("/") || failed) return null;

  return (
    <div className="ts-card-media" aria-hidden>
      <img
        src={`https://opengraph.githubassets.com/1/${fullName}`}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
      <span className="ts-card-media-fade" />
    </div>
  );
}
