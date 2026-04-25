import { describe, it, expect } from "vitest";
import {
  avatarFallbackHue,
  openLabelForSource,
  popularityForProject,
  popularityClass,
  popularityClassLabel,
  formatRelativeShort,
  metricsForProject,
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

  it("returns 'View package' for AUR and NuGet (package vocabulary)", () => {
    expect(openLabelForSource("aur")).toBe("View package");
    expect(openLabelForSource("nuget")).toBe("View package");
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

// Helper: ISO string for "n days ago" relative to now.
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

describe("popularityClass", () => {
  it("returns 'hot' for fresh repos with 1k+ stars in <30 days", () => {
    const p = makeProject({ source: "github", stars: 1500, createdAt: daysAgo(20) });
    expect(popularityClass(p)).toBe("hot");
  });

  it("returns 'trending' for >5k stars and <6 months old", () => {
    const p = makeProject({ source: "github", stars: 8000, createdAt: daysAgo(120) });
    expect(popularityClass(p)).toBe("trending");
  });

  it("returns 'rising' for 1k-5k stars and <1 year old", () => {
    const p = makeProject({ source: "github", stars: 2500, createdAt: daysAgo(200) });
    expect(popularityClass(p)).toBe("rising");
  });

  it("returns 'established' for >10k stars and >3 years old", () => {
    const p = makeProject({ source: "github", stars: 50_000, createdAt: daysAgo(365 * 5) });
    expect(popularityClass(p)).toBe("established");
  });

  it("returns 'new' for any project under 60 days old without other classes", () => {
    const p = makeProject({ source: "github", stars: 5, createdAt: daysAgo(40) });
    expect(popularityClass(p)).toBe("new");
  });

  it("returns null when no createdAt", () => {
    const p = makeProject({ source: "github", stars: 50_000 });
    delete (p as Partial<UnifiedProject>).createdAt;
    expect(popularityClass(p)).toBeNull();
  });

  it("returns null for old, modestly-starred projects", () => {
    const p = makeProject({ source: "github", stars: 200, createdAt: daysAgo(800) });
    expect(popularityClass(p)).toBeNull();
  });

  it("'hot' takes precedence over 'trending' on overlap", () => {
    const p = makeProject({ source: "github", stars: 6000, createdAt: daysAgo(20) });
    expect(popularityClass(p)).toBe("hot");
  });
});

describe("popularityClassLabel", () => {
  it("returns the human label for each non-null class", () => {
    expect(popularityClassLabel("hot")).toBe("Hot");
    expect(popularityClassLabel("trending")).toBe("Trending");
    expect(popularityClassLabel("rising")).toBe("Rising");
    expect(popularityClassLabel("new")).toBe("New");
    expect(popularityClassLabel("established")).toBe("Established");
  });

  it("returns empty string for null", () => {
    expect(popularityClassLabel(null)).toBe("");
  });
});

describe("formatRelativeShort", () => {
  it("returns 'today' for under-24h", () => {
    expect(formatRelativeShort(daysAgo(0.2))).toBe("today");
  });
  it("returns days for 1-6 days ago", () => {
    expect(formatRelativeShort(daysAgo(3))).toBe("3d");
  });
  it("returns weeks for 7-29 days", () => {
    expect(formatRelativeShort(daysAgo(14))).toBe("2w");
  });
  it("returns months for 30-364 days", () => {
    expect(formatRelativeShort(daysAgo(90))).toBe("3mo");
  });
  it("returns years past 365 days", () => {
    expect(formatRelativeShort(daysAgo(800))).toBe("2y");
  });
  it("returns empty string for invalid / empty input", () => {
    expect(formatRelativeShort("")).toBe("");
    expect(formatRelativeShort("not-a-date")).toBe("");
  });
});

describe("metricsForProject", () => {
  it("returns Stars / Forks / Issues for github repos", () => {
    const p = makeProject({
      source: "github",
      stars: 1234,
      forks: 200,
      openIssues: 17,
    });
    const cells = metricsForProject(p);
    expect(cells.map((c) => c.label)).toEqual(["Stars", "Forks", "Issues"]);
    expect(cells[0].value).toBe("1.2k");
  });

  it("drops empty cells (no padding with —)", () => {
    const p = makeProject({ source: "github", stars: 1234 });
    const cells = metricsForProject(p);
    // Forks and Issues missing — only Stars cell.
    expect(cells.length).toBe(1);
    expect(cells[0].label).toBe("Stars");
  });

  it("surfaces Downloads / Version / Published for npm", () => {
    const p = makeProject({
      source: "npm",
      version: "2.0.1",
      lastPublished: daysAgo(5),
      weeklyDownloads: 50_000,
    });
    const cells = metricsForProject(p);
    expect(cells.map((c) => c.label)).toEqual([
      "Downloads",
      "Version",
      "Published",
    ]);
    expect(cells.find((c) => c.label === "Version")?.value).toBe("2.0.1");
  });

  it("surfaces Upvotes / Comments / Posted for HN threads", () => {
    const p = makeProject({
      source: "hackernews",
      upvotes: 312,
      comments: 47,
      createdAt: daysAgo(2),
    });
    const cells = metricsForProject(p);
    expect(cells.map((c) => c.label)).toEqual([
      "Upvotes",
      "Comments",
      "Posted",
    ]);
  });

  it("surfaces Citations(or Downloads) / Year / Authors for arxiv papers", () => {
    const p = makeProject({
      source: "arxiv",
      paperYear: 2024,
      paperAuthors: ["Alice", "Bob", "Carol"],
    });
    const cells = metricsForProject(p);
    const labels = cells.map((c) => c.label);
    expect(labels).toContain("Year");
    expect(labels).toContain("Authors");
    const yearCell = cells.find((c) => c.label === "Year");
    expect(yearCell?.value).toBe("2024");
    const authorsCell = cells.find((c) => c.label === "Authors");
    expect(authorsCell?.value).toBe("3");
  });

  it("caps at 3 cells per project", () => {
    const p = makeProject({
      source: "github",
      stars: 1000,
      forks: 100,
      openIssues: 10,
      watchers: 50,
    });
    expect(metricsForProject(p).length).toBeLessThanOrEqual(3);
  });
});
