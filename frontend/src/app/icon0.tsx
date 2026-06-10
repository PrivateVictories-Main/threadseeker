import { ImageResponse } from "next/og";
import { BrandTile } from "./icon-art";

// 192×192 PWA/app icon — build-time ImageResponse like opengraph-image.tsx,
// so no binary assets live in the repo. Numbered files (icon0/1/2) instead
// of one icon.tsx with generateImageMetadata because multi-variant metadata
// routes can't statically render under `output: export`. manifest.ts
// references the exported /icon0 route; the route is extensionless (like
// /opengraph-image), so public/_headers pins its Content-Type — the global
// nosniff forbids MIME-sniffing it back.
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon192() {
  return new ImageResponse(<BrandTile size={192} />, size);
}
