// Unit tests for the cross-source dedup logic. These guard against the
// classic failure modes: (a) over-merging unrelated projects that happen to
// share a name, (b) under-merging the same project when it's spelled
// slightly differently across platforms.

import { describe, expect, it } from "vitest";
import { mergeRelatedProjects } from "./merge";
import type { UnifiedProject, SourceType } from "./types";

function project(overrides: Partial<UnifiedProject>): UnifiedProject {
  const base: UnifiedProject = {
    id: Math.random().toString(36),
    source: "github" as SourceType,
    name: "x",
    fullName: "x/x",
    description: null,
    url: "https://example.com",
    stars: 0,
    language: null,
    topics: [],
    author: { name: "", avatar: "" },
    updatedAt: new Date().toISOString(),
  };
  return { ...base, ...overrides };
}

describe("mergeRelatedProjects", () => {
  it("folds identical-name cross-platform duplicates into one card", () => {
    const github = project({
      source: "github",
      name: "fastapi",
      fullName: "tiangolo/fastapi",
      description: "FastAPI framework, high performance, easy to learn",
      stars: 70_000,
    });
    const pypi = project({
      source: "pypi",
      name: "fastapi",
      fullName: "fastapi",
      description: "FastAPI framework, high performance",
    });
    const merged = mergeRelatedProjects([github, pypi]);
    expect(merged.length).toBe(1);
    expect(merged[0].source).toBe("github");
    expect(merged[0].relatedSources?.some((r) => r.source === "pypi")).toBe(true);
  });

  it("normalizes language prefixes to collapse 'python-requests' and 'requests'", () => {
    const prefixed = project({
      source: "github",
      name: "python-requests",
      fullName: "psf/python-requests",
      description: "Python HTTP library for humans",
    });
    const canonical = project({
      source: "pypi",
      name: "requests",
      fullName: "requests",
      description: "Python HTTP library for humans",
    });
    const merged = mergeRelatedProjects([prefixed, canonical]);
    expect(merged.length).toBe(1);
  });

  it("keeps thread-like sources out of dedup", () => {
    const hn = project({
      source: "hackernews",
      name: "react",
      fullName: "hn:123",
      description: "Show HN: react 19 is out",
    });
    const repo = project({
      source: "github",
      name: "react",
      fullName: "facebook/react",
      description: "A JavaScript library for building user interfaces",
    });
    const merged = mergeRelatedProjects([hn, repo]);
    expect(merged.length).toBe(2);
  });

  it("does not merge projects that happen to share a name but differ in topic", () => {
    const a = project({
      source: "npm",
      name: "hammer",
      fullName: "hammer",
      description: "Touch gesture library for mobile web",
    });
    const b = project({
      source: "pypi",
      name: "hammer",
      fullName: "hammer",
      description: "Build system for Scala projects",
    });
    const merged = mergeRelatedProjects([a, b]);
    // No shared repo, no overlapping description tokens — must not merge.
    expect(merged.length).toBe(2);
  });

  it("picks the canonical source by priority, not by comparing stars-vs-downloads across sources", () => {
    // A WordPress plugin with huge install counts must NOT out-rank the primary
    // npm package as the canonical card just because installs > 0. Same shared
    // description so they merge; npm (registry) outranks wordpress.
    const npm = project({
      source: "npm",
      name: "gallery",
      fullName: "gallery",
      description: "responsive image gallery lightbox component",
      downloads: 5_000,
    });
    const wordpress = project({
      source: "wordpress",
      name: "gallery",
      fullName: "gallery",
      description: "responsive image gallery lightbox component",
      downloads: 2_000_000,
    });
    const merged = mergeRelatedProjects([wordpress, npm]);
    expect(merged.length).toBe(1);
    expect(merged[0].source).toBe("npm");
    expect(merged[0].relatedSources?.some((r) => r.source === "wordpress")).toBe(true);
  });

  it("GitHub repo wins over package registry as the primary card", () => {
    const github = project({
      source: "github",
      name: "next",
      fullName: "vercel/next.js",
      description: "The React Framework for Production",
      stars: 120_000,
    });
    const npm = project({
      source: "npm",
      name: "next",
      fullName: "next",
      description: "The React Framework for Production",
    });
    const merged = mergeRelatedProjects([npm, github]);
    expect(merged.length).toBe(1);
    expect(merged[0].source).toBe("github");
  });
});
