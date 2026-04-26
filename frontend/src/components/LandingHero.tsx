"use client";

// Iter-23 / Major Overhaul I — landing hero card.
//
// Replaces the previous centered "search-on-hero" layout. The hero is
// now a glass-strong rounded panel taking ~50vh, containing: a small
// caption, a two-line headline, a supporting tagline, and a decorative
// blob layer behind it. The actual SearchBar lives in the persistent
// AppTopBar — this hero exists purely to set the tone of the landing
// page.

interface Props {
  sourceCount: number;
}

export function LandingHero({ sourceCount }: Props) {
  return (
    <section className="ts-landing-hero" aria-label="ThreadSeeker introduction">
      <div className="ts-landing-hero-blob is-tr" aria-hidden />
      <div className="ts-landing-hero-blob is-bl" aria-hidden />
      <div className="ts-landing-hero-blob is-tl" aria-hidden />
      <div className="ts-landing-hero-grid" aria-hidden />

      <div className="ts-landing-hero-inner">
        <span className="ts-hero-caption" aria-hidden>
          Open-Source Index
        </span>
        <h1 className="ts-hero-headline text-balance">
          Find what&apos;s worth{" "}
          <span className="ts-hero-accent">building on.</span>
        </h1>
        <p className="ts-landing-hero-tagline">
          One query across {sourceCount} platforms — repositories, packages,
          AI models, and community threads. No accounts, no tracking.
        </p>
        <div className="ts-landing-hero-meta">
          <span>Search above</span>
          <kbd>/</kbd>
          <span>or</span>
          <kbd>⌘K</kbd>
          <span>to focus</span>
        </div>
      </div>
    </section>
  );
}
