"use client";

// ThreadSeeker wordmark — small monospace logotype.
//
// Variants:
//   - "hero":   visible only on the landing hero, sits top-left of the page
//               with a small accent glyph and a `v1.0` build chip beside it.
//   - "inline": compact wordmark for the sticky results-mode header. Drops
//               the version chip; keeps the glyph + name so the brand tracks
//               the user from hero into results without re-introducing chrome.
//
// The glyph is the literal character `≡` rendered inside an indigo-gradient
// rounded square — reads as an "index" / "stack" mark, no emoji.

interface Props {
  variant?: "hero" | "inline";
  showVersion?: boolean;
  className?: string;
}

const VERSION = "v1.0";

export function BrandMark({ variant = "hero", showVersion, className = "" }: Props) {
  const includeVersion = showVersion ?? variant === "hero";
  return (
    <a
      href="/"
      className={`ts-brand ${className}`}
      aria-label="ThreadSeeker — return to home"
    >
      <span className="ts-brand-glyph" aria-hidden>
        ≡
      </span>
      <span className="ts-brand-name">
        <strong>thread</strong>seeker
      </span>
      {includeVersion && (
        <span className="ts-brand-version" aria-hidden>
          {VERSION}
        </span>
      )}
    </a>
  );
}
