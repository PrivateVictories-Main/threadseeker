import type { MetadataRoute } from "next";

// Generated sitemap (replaces the hand-edited public/sitemap.xml). Today the app
// is a single statically-rendered shell, so this lists the canonical root only.
// It is the seam for the planned statically-exported search/[slug] routes — when
// those land, map them in here and each becomes a real indexable entry.
const BASE = "https://threadseeker.pages.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE}/`,
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
