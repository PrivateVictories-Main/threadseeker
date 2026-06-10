import { ImageResponse } from "next/og";
import { BrandTile } from "./icon-art";

// iOS home-screen icon (auto-linked as apple-touch-icon). Apple rounds the
// corners itself, so paint the full square — transparent corners would
// composite as black on the springboard. Reuses the maskable full-bleed
// variant of the shared brand tile.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandTile size={180} maskable />, size);
}
