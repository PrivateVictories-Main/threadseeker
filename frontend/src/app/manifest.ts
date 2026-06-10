import type { MetadataRoute } from "next";
import { ALL_SOURCE_TYPES } from "@/lib/sources/registry";

// PWA web app manifest — exported as /manifest.webmanifest and auto-linked
// from <head> by Next. Icon srcs are the build-time ImageResponse routes
// from icon0/1/2.tsx (extensionless, Content-Type pinned in public/_headers).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ThreadSeeker",
    short_name: "ThreadSeeker",
    description: `Search the open-source world at once — GitHub, npm, PyPI, Hugging Face and ${ALL_SOURCE_TYPES.length} platforms total, ranked side by side. Free, no account.`,
    start_url: "/",
    display: "standalone",
    // Light --background token (hsl(228 100% 97%)) — matches the light
    // viewport themeColor in layout.tsx, used for the install splash.
    background_color: "#eef2ff",
    // The app follows the system theme, so no single surface color is always
    // right; the indigo accent (--ts-accent-strong, also the icon-tile
    // gradient start) reads correctly against both palettes.
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon0", sizes: "192x192", type: "image/png" },
      { src: "/icon1", sizes: "512x512", type: "image/png" },
      {
        src: "/icon2",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
