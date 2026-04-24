import { describe, it, expect } from "vitest";
import { avatarFallbackHue } from "./helpers";

const PALETTE = [210, 220, 230, 240, 250, 260, 270, 280];

describe("avatarFallbackHue", () => {
  it("returns a hue inside the indigo/violet/sky-adjacent palette", () => {
    for (const id of [
      "github-foo/bar",
      "npm-react",
      "pypi-numpy",
      "crates-tokio",
      "homebrew-formula-htop",
      "huggingface-bert-base",
    ]) {
      expect(PALETTE).toContain(avatarFallbackHue(id));
    }
  });

  it("is stable for the same id (same id → same hue)", () => {
    const id = "github-vercel/next.js";
    const a = avatarFallbackHue(id);
    const b = avatarFallbackHue(id);
    expect(a).toBe(b);
  });

  it("distributes across multiple hues for varied ids", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      seen.add(avatarFallbackHue(`project-${i}-${i * 17}`));
    }
    // With 200 random-ish ids over an 8-bucket palette, we should hit
    // most buckets — anything less than 4 means the hash is degenerate.
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it("handles empty string without throwing", () => {
    expect(PALETTE).toContain(avatarFallbackHue(""));
  });
});
