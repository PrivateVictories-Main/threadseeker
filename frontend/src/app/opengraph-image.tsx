import { ImageResponse } from "next/og";

// Build-time-generated social card (1200×630) so shares aren't blank — the
// twitter:summary_large_image / og:image meta previously had no image. Motif
// echoes the SourceConstellation: brand-colored source dots on dark glass.
export const alt = "ThreadSeeker — search the open-source world";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DOTS = [
  { c: "#CB3837", x: 110, y: 120, r: 26 }, // npm
  { c: "#3775A9", x: 1000, y: 90, r: 22 }, // pypi
  { c: "#2496ED", x: 1060, y: 360, r: 30 }, // docker
  { c: "#FF4500", x: 210, y: 470, r: 20 }, // reddit
  { c: "#FFD21E", x: 1090, y: 540, r: 18 }, // hugging face
  { c: "#e6a06c", x: 80, y: 330, r: 15 }, // rust
  { c: "#FC6D26", x: 940, y: 220, r: 14 }, // gitlab
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "84px",
          background: "linear-gradient(135deg, #0b1020 0%, #141a2e 48%, #0e1322 100%)",
          color: "#e7ecf5",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {DOTS.map((d, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.x,
              top: d.y,
              width: d.r * 2,
              height: d.r * 2,
              borderRadius: 999,
              background: d.c,
              opacity: 0.9,
            }}
          />
        ))}
        <div
          style={{
            fontSize: 28,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#818cf8",
            fontWeight: 700,
          }}
        >
          Open-Source Index
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", fontSize: 82, fontWeight: 600, marginTop: 18, maxWidth: 920, lineHeight: 1.05 }}>
          <span>The whole open-source world,&nbsp;</span>
          <span style={{ color: "#818cf8" }}>one thread.</span>
        </div>
        <div style={{ fontSize: 30, marginTop: 30, color: "#aab6cd", maxWidth: 920 }}>
          One query across 28 sources — GitHub, npm, PyPI, Hugging Face, Docker & more.
        </div>
        <div style={{ position: "absolute", bottom: 64, left: 84, fontSize: 26, color: "#7e8aa6", fontFamily: "monospace" }}>
          threadseeker.pages.dev
        </div>
      </div>
    ),
    { ...size },
  );
}
