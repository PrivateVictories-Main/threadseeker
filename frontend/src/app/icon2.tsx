import { ImageResponse } from "next/og";
import { BrandTile } from "./icon-art";

// 512×512 MASKABLE PWA icon (purpose: "maskable" in manifest.ts, served as
// /icon2): full-bleed background + glyph pulled into the central safe zone,
// for launchers that apply their own shape mask. See icon0.tsx for why the
// icons are numbered single-variant files.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function IconMaskable512() {
  return new ImageResponse(<BrandTile size={512} maskable />, size);
}
