import { ImageResponse } from "next/og";
import { BrandTile } from "./icon-art";

// 512×512 PWA/app icon — see icon0.tsx for why the icons are numbered
// single-variant files. Referenced by manifest.ts as /icon1.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon512() {
  return new ImageResponse(<BrandTile size={512} />, size);
}
