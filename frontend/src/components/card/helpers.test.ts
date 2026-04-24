import { describe, it, expect } from "vitest";
import {
  avatarFallbackHue,
  openLabelForSource,
  popularityForProject,
} from "./helpers";
import type { UnifiedProject } from "@/lib/sources/types";
import type { SourceType } from "@/lib/sources/types";

// Minimal UnifiedProject factory so tests focus on the popularity-shape
// fields without dragging the full data contract into every assertion.
function makeProject(over: Partial<UnifiedProject> & { source: SourceType }): UnifiedProject {
  return {
    id: "test-id",
    name: "test",
    fullName: "owner/test",
    description: null,
    url: "https://example.com",
    stars: 0,
    language: null,
    topics: [],
    author: { name: "owner", avatar: "" },
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

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

describe("openLabelForSource", () => {
  it("returns thread vocabulary for forum-shaped sources", () => {
    expect(openLabelForSource("reddit")).toBe("Open thread");
    expect(openLabelForSource("hackernews")).toBe("Open thread");
    expect(openLabelForSource("lobsters")).toBe("Open thread");
  });

  it("returns 'View answer' for Stack Overflow (sharper than generic thread)", () => {
    expect(openLabelForSource("stackoverflow")).toBe("View answer");
  });

  it("returns 'View paper' for scholarly sources", () => {
    expect(openLabelForSource("arxiv")).toBe("View paper");
    expect(openLabelForSource("paperswithcode")).toBe("View paper");
    expect(openLabelForSource("zenodo")).toBe("View paper");
  });

  it("returns app/extension/plugin labels for distribution sources", () => {
    expect(openLabelForSource("flathub")).toBe("Get app");
    expect(openLabelForSource("fdroid")).toBe("Get app");
    expect(openLabelForSource("openvsx")).toBe("Install extension");
    expect(openLabelForSource("wordpress")).toBe("View plugin");
    expect(openLabelForSource("dockerhub")).toBe("Pull image");
  });

  it("falls back to generic 'Open' for repos and packages", () => {
    expect(openLabelForSource("github")).toBe("Open");
    expect(openLabelForSource("gitlab")).toBe("Open");
    expect(openLabelForSource("npm")).toBe("Open");
    expect(openLabelForSource("crates")).toBe("Open");
    expect(openLabelForSource("pypi")).toBe("Open");
  });
});

describe("popularityForProject", () => {
  it("uses ★ for repo stars on github", () => {
    const p = makeProject({ source: "github", stars: 1234 });
    expect(popularityForProject(p)).toBe("★ 1.2k");
  });

  it("uses ▲ for thread upvotes and appends 💬 comment count when present", () => {
    const p = makeProject({
      source: "hackernews",
      stars: 312,
      commentsCount: 47,
    });
    expect(popularityForProject(p)).toBe("▲ 312 · 💬 47");
  });

  it("renders thread upvotes alone when there are no comments", () => {
    const p = makeProject({ source: "reddit", stars: 12 });
    expect(popularityForProject(p)).toBe("▲ 12");
  });

  it("returns ↓ download count for packages without star signal", () => {
    const p = makeProject({ source: "npm", stars: 0, downloads: 5_400_000 });
    expect(popularityForProject(p)).toBe("↓ 5.4M");
  });

  it("returns null when paper/source has no popularity signal at all", () => {
    const p = makeProject({ source: "arxiv", stars: 0 });
    expect(popularityForProject(p)).toBeNull();
  });

  it("returns null on a thread with no upvotes and no comments", () => {
    const p = makeProject({ source: "lobsters", stars: 0 });
    expect(popularityForProject(p)).toBeNull();
  });
});
