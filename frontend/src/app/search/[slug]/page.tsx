// /search/[slug] — statically-exported SEO landing pages.
//
// Before this route the entire site was ONE indexable URL (the client-shell
// home page); every ?q= variant served identical HTML. Each landing here is
// a real server-rendered page for one curated query (the corpus in
// lib/seo-routes, derived from lib/suggestions): unique title/description/
// canonical, an h1 + explainer + related-search internal links baked into
// the static HTML, and then the full live app mounted underneath, pre-seeded
// so the query auto-runs on hydration exactly like a ?q= deep link.
//
// Static-export rules honored: generateStaticParams enumerates the whole
// corpus and dynamicParams=false refuses anything else, so `output: export`
// can emit every page at build time with zero runtime server features.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeApp } from "../../home-app";
import {
  SEO_LANDINGS,
  getLandingBySlug,
  getRelatedLandings,
  landingDescription,
} from "@/lib/seo-routes";
// Registry import (not the lib/sources barrel) keeps the server module graph
// to pure display config — no need to pull the fetch/rank machinery into a
// route that only wants the live platform count.
import { ALL_SOURCE_TYPES } from "@/lib/sources/registry";
import styles from "./seo-shell.module.css";

// Single origin constant for the absolute URLs JSON-LD requires (metadataBase
// only auto-prefixes <head> metadata, not script bodies). Matches layout.tsx
// metadataBase + sitemap.ts.
const SITE_ORIGIN = "https://threadseeker.pages.dev";

const SOURCE_COUNT = ALL_SOURCE_TYPES.length;

// Every corpus slug becomes a static page; anything else 404s at build time
// rather than silently falling back to a server render the export can't do.
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return SEO_LANDINGS.map(({ slug }) => ({ slug }));
}

interface Props {
  params: { slug: string };
}

export function generateMetadata({ params }: Props): Metadata {
  const landing = getLandingBySlug(params.slug);
  // dynamicParams=false means this can't happen for a built page; the guard
  // is for type narrowing + a loud failure if the corpus ever drifts.
  if (!landing) return {};

  const title = `${landing.query} — search ${SOURCE_COUNT}+ open-source platforms | ThreadSeeker`;
  const description = landingDescription(landing, SOURCE_COUNT);
  // Trailing slash matches the exported directory URLs (next.config
  // trailingSlash: true), so the canonical is byte-identical to the URL
  // Cloudflare Pages actually serves — no redirect hop for crawlers.
  const path = `/search/${landing.slug}/`;

  return {
    title,
    description,
    alternates: {
      // Overrides the layout-level canonical ("/") that exists to collapse
      // ?q= variants of the home shell — each landing is its own canonical.
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "ThreadSeeker",
      type: "website",
      // Next's metadata merge is SHALLOW: defining openGraph/twitter here
      // replaces the root-resolved objects entirely, so the file-convention
      // opengraph-image never reaches these pages unless re-declared.
      // metadataBase (layout.tsx) makes the relative path absolute.
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default function SearchLandingPage({ params }: Props) {
  const landing = getLandingBySlug(params.slug);
  if (!landing) notFound();

  const related = getRelatedLandings(landing.slug, 6);

  // BreadcrumbList structured data — pairs with the WebSite + SearchAction
  // JSON-LD in the root layout so Google can render "ThreadSeeker › query"
  // breadcrumbs instead of the raw /search/... URL in result snippets.
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "ThreadSeeker",
        item: `${SITE_ORIGIN}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: landing.query,
        item: `${SITE_ORIGIN}/search/${landing.slug}/`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Server-rendered SEO band — the page's real content even with JS off.
          Sits above the client shell; once hydration auto-runs the query, the
          live results render directly below it. */}
      <section
        className={styles.shell}
        aria-label={`About this ${landing.query} search`}
      >
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">ThreadSeeker</Link>
          <span aria-hidden>/</span>
          <span>Search</span>
          <span aria-hidden>/</span>
          <span className={styles.crumbCurrent} aria-current="page">
            {landing.query}
          </span>
        </nav>

        <h1 className={styles.h1}>{landing.query}</h1>

        <p className={styles.lede}>
          One search for open-source <strong>{landing.query}</strong> projects
          across {SOURCE_COUNT} platforms — GitHub, GitLab, npm, PyPI,
          crates.io, Hugging Face, Docker Hub, arXiv, Hacker News, and more —
          ranked side by side by stars, downloads, freshness, and community
          discussion. Results load live below; free, no account, no tracking.
        </p>

        <div className={styles.related}>
          <span className={styles.relatedLabel}>{"// Related"}</span>
          {related.map((r) => (
            <Link
              key={r.slug}
              href={`/search/${r.slug}/`}
              className={styles.relatedChip}
            >
              {r.query}
            </Link>
          ))}
        </div>
      </section>

      {/* The full client app, pre-seeded — hydration runs the slug's query
          through the exact ?q= deep-link path in page.tsx. */}
      <HomeApp initialQuery={landing.query} />
    </>
  );
}
