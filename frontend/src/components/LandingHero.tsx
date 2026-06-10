"use client";

// Iter-26 — landing hero as a real entry point.
//
// The hero is a glass panel whose backdrop is the SourceConstellation (the
// signature centerpiece — 9 brand-colored source nodes woven by a drifting
// thread). On top: caption, headline, tagline, a FOCAL search bar, and
// one-click example-query chips. Previously the hero was all-text with only a
// "press /" hint — the most valuable real estate on a search product offered
// no input.

import { SourceConstellation } from "./SourceConstellation";
import { SearchBar } from "./SearchBar";
import type { SourceType } from "@/lib/sources/types";

interface Props {
  /** h1 on "/", h2 on /search/[slug] landings (which own their h1). */
  headingLevel?: "h1" | "h2";
  sourceCount: number;
  /** No longer consumed — the constellation's node roster is static now.
   *  Kept (optional) so existing call sites passing it still compile. */
  sources?: SourceType[];
  onSearch: (query: string) => void;
  history?: string[];
}

// Diverse intent shapes so the chips read as "you can search anything".
const EXAMPLES = [
  "react state management",
  "rust http framework",
  "local llm runtime",
  "vector database",
  "self-hosted photo library",
];

export function LandingHero({ sourceCount, onSearch, history = [], headingLevel = "h1" }: Props) {
  // /search/[slug] landings render their own unique <h1> in the static SEO
  // band; the hero headline demotes to <h2> there so each landing has exactly
  // one h1 (the query) instead of two.
  const Headline = headingLevel;
  return (
    <section className="ts-landing-hero" aria-label="ThreadSeeker introduction">
      <SourceConstellation />

      <div className="ts-landing-hero-inner">
        <span className="ts-hero-caption" aria-hidden>
          Open-Source Index
        </span>
        <Headline className="ts-hero-headline text-balance">
          The whole open-source world,{" "}
          <span className="ts-hero-accent">one thread.</span>
        </Headline>
        <p className="ts-landing-hero-tagline">
          One query across {sourceCount} platforms — repositories, packages, AI
          models, and community threads. No accounts, no tracking.
        </p>

        <div className="ts-hero-search">
          <SearchBar
            onSearch={onSearch}
            isLoading={false}
            size="hero"
            sourceCount={sourceCount}
            history={history}
          />
        </div>

        <div className="ts-hero-examples" aria-label="Example searches">
          <span className="ts-hero-examples-label">Try</span>
          {EXAMPLES.map((ex) => (
            // Real crawlable anchor (the ?q= deep-link is honored on load), with
            // onClick doing the in-place SPA search — progressive enhancement so
            // Googlebot can discover the query space instead of hitting dead-end
            // JS-only buttons.
            <a
              key={ex}
              href={`/?q=${encodeURIComponent(ex)}`}
              className="ts-hero-example-chip"
              onClick={(e) => {
                e.preventDefault();
                onSearch(ex);
              }}
            >
              {ex}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
