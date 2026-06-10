// Shared brand-tile artwork for every generated app icon (icon0/1/2.tsx,
// apple-icon.tsx) — one source of truth so the favicon links, PWA manifest
// icons and apple-touch-icon can never drift apart visually.
//
// Visual language mirrors BrandMark (the ≡ glyph on an indigo-gradient
// rounded square; see .ts-brand-glyph + --ts-accent-gradient in
// styles/tokens.css) and opengraph-image.tsx (indigo accent, white marks on
// the tile). Rendered as real shapes instead of the ≡ character because the
// Satori (ImageResponse) default font isn't guaranteed to carry that glyph:
// three white "thread" bars, the top one broken into a bar + a round
// "seeker" dot travelling along it.

interface TileProps {
  /** Output square edge in px (180 / 192 / 512). All metrics scale off 512. */
  size: number;
  /**
   * Maskable mode paints the full square (the platform applies its own
   * mask — transparent corners turn into black artifacts) and shrinks the
   * glyph into the central safe zone.
   */
  maskable?: boolean;
}

export function BrandTile({ size, maskable = false }: TileProps) {
  const s = size / 512;
  // Maskable safe zone is the central 80% — pull the glyph in a notch.
  const g = s * (maskable ? 0.78 : 1);
  const barH = Math.round(38 * g);
  const longW = Math.round(232 * g);
  const shortW = Math.round(150 * g);
  const dot = Math.round(44 * g);
  const rowGap = Math.round(38 * g);
  const stackGap = Math.round(34 * g);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: stackGap,
        // Light-mode --ts-accent-gradient (indigo → azure). Icons render on
        // arbitrary OS chrome, so the saturated light-theme ramp reads best.
        background: "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)",
        // ~22.5% corner radius ≈ the squircle ratio of platform app tiles.
        borderRadius: maskable ? 0 : Math.round(size * 0.225),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: rowGap }}>
        <div
          style={{
            width: shortW,
            height: barH,
            borderRadius: 999,
            background: "#ffffff",
          }}
        />
        <div
          style={{
            width: dot,
            height: dot,
            borderRadius: 999,
            background: "#ffffff",
          }}
        />
      </div>
      <div
        style={{
          width: longW,
          height: barH,
          borderRadius: 999,
          background: "#ffffff",
        }}
      />
      <div
        style={{
          width: longW,
          height: barH,
          borderRadius: 999,
          background: "#ffffff",
        }}
      />
    </div>
  );
}
