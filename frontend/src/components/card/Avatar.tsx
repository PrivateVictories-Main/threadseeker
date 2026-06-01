"use client";

import { useState } from "react";
import { avatarFallbackHue } from "./helpers";

interface Props {
  src?: string;
  /** Used for the fallback initial + the alt-less decorative letter. */
  name: string;
  /** Stable id → deterministic fallback hue. */
  id: string;
  /** Base avatar class (e.g. "ts-avatar" or "ts-list-avatar"). */
  className: string;
  /** Fallback-only class (e.g. "ts-avatar-fallback"). */
  fallbackClassName: string;
}

// Avatar with graceful degradation: dead/blocked image URLs (common across
// 28 heterogeneous sources) fall back to the hashed-hue initial circle
// instead of a broken-image glyph. Centralizes what was duplicated in the
// grid card and the list row.
export function Avatar({ src, name, id, className, fallbackClassName }: Props) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={className}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${className} ${fallbackClassName}`}
      aria-hidden
      style={{ ["--ts-fallback-hue" as string]: avatarFallbackHue(id) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
