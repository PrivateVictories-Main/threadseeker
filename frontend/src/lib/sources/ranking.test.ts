// Pure-unit tests for calculateRelevanceScore. Hand-crafted fixtures let us
// lock down ranking tie-breakers that are easy to regress when tuning
// weights. If one of these fails after a weight change, it means the new
// weights have changed user-visible ordering — re-check the expectation
// is what you actually want, then update both together.

import { describe, expect, it } from "vitest";
import { calculateRelevanceScore } from "./ranking";
import type { UnifiedProject, SourceType } from "./types";

function project(overrides: Partial<UnifiedProject>): UnifiedProject {
  const base: UnifiedProject = {
    id: "x",
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

describe("calculateRelevanceScore", () => {
  it("ranks exact name match above fuzzy name match", () => {
    const exact = project({ name: "axios", fullName: "axios/axios" });
    const fuzzy = project({ name: "axios-retry", fullName: "softonic/axios-retry" });
    expect(calculateRelevanceScore(exact, "axios")).toBeGreaterThan(
      calculateRelevanceScore(fuzzy, "axios"),
    );
  });

  it("ranks starts-with above contains", () => {
    const starts = project({ name: "fastapi-users", stars: 100 });
    const contains = project({ name: "my-fastapi-template", stars: 100 });
    expect(calculateRelevanceScore(starts, "fastapi")).toBeGreaterThan(
      calculateRelevanceScore(contains, "fastapi"),
    );
  });

  it("boosts popular projects over unknown ones", () => {
    const popular = project({ name: "react", fullName: "facebook/react", stars: 200_000 });
    const obscure = project({ name: "react", fullName: "someone/react", stars: 0 });
    expect(calculateRelevanceScore(popular, "react")).toBeGreaterThan(
      calculateRelevanceScore(obscure, "react"),
    );
  });

  it("penalizes very stale low-star projects", () => {
    const fresh = project({
      name: "lib",
      stars: 50,
      updatedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    });
    const abandoned = project({
      name: "lib",
      stars: 50,
      updatedAt: new Date(Date.now() - 5 * 365 * 86_400_000).toISOString(),
    });
    expect(calculateRelevanceScore(fresh, "lib")).toBeGreaterThan(
      calculateRelevanceScore(abandoned, "lib"),
    );
  });

  it("language intent boosts matching ecosystem", () => {
    const javaLib = project({
      name: "jackson",
      source: "maven" as SourceType,
      language: "Java",
      fullName: "com.fasterxml.jackson.core:jackson-core",
    });
    const jsLib = project({
      name: "jackson",
      source: "npm" as SourceType,
      language: "JavaScript",
      fullName: "jackson",
    });
    expect(calculateRelevanceScore(javaLib, "java jackson")).toBeGreaterThan(
      calculateRelevanceScore(jsLib, "java jackson"),
    );
  });

  it("zero-signal noise is penalized heavily", () => {
    const noisy = project({
      name: "match",
      stars: 0,
      description: null,
      downloads: 0,
    });
    const solid = project({
      name: "match",
      stars: 0,
      description: "A real library that does the thing you searched for.",
      downloads: 100,
    });
    expect(calculateRelevanceScore(solid, "match")).toBeGreaterThan(
      calculateRelevanceScore(noisy, "match"),
    );
  });

  it("all query tokens present boosts multi-word matches", () => {
    const hits = project({
      name: "http-client",
      description: "A tiny Python http client",
    });
    const partial = project({
      name: "http",
      description: "http server framework",
    });
    expect(calculateRelevanceScore(hits, "python http client")).toBeGreaterThan(
      calculateRelevanceScore(partial, "python http client"),
    );
  });
});
