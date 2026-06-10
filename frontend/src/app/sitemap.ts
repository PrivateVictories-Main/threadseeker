import type { MetadataRoute } from "next";
import { SEO_LANDINGS } from "@/lib/seo-routes";

// Generated sitemap (replaces the hand-edited public/sitemap.xml). The root
// shell plus every statically-exported /search/[slug] landing — both derive
// from the same corpus module (lib/seo-routes), so a new curated query lands
// in the route AND the sitemap in the same build, no drift.
const BASE = "https://threadseeker.pages.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    // Trailing slashes match the exported directory URLs (next.config
    // trailingSlash: true) so crawlers never bounce through a redirect.
    ...SEO_LANDINGS.map(({ slug }) => ({
      url: `${BASE}/search/${slug}/`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
