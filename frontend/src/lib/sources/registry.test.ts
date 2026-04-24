import { describe, it, expect } from "vitest";
import { isSparseSource, sparseFraction, getSourceConfig } from "./registry";

describe("sparseFraction", () => {
  it("returns 0 for empty source list", () => {
    expect(sparseFraction([])).toBe(0);
  });

  it("returns 1 for all-sparse selection", () => {
    expect(
      sparseFraction(["hackernews", "reddit", "lobsters", "stackoverflow", "devto"]),
    ).toBe(1);
  });

  it("returns 0 for no-sparse selection (repos / packages)", () => {
    expect(sparseFraction(["github", "gitlab", "npm", "pypi"])).toBe(0);
  });

  it("returns the right fraction for mixed selections", () => {
    // 2 sparse / 5 total = 0.4
    expect(sparseFraction(["github", "npm", "pypi", "reddit", "hackernews"])).toBeCloseTo(
      0.4,
      5,
    );
    // 3 sparse / 5 total = 0.6 (threshold)
    expect(
      sparseFraction(["github", "npm", "reddit", "hackernews", "lobsters"]),
    ).toBeCloseTo(0.6, 5);
  });
});

describe("isSparseSource", () => {
  it("flags community discussion sources as sparse", () => {
    expect(isSparseSource("hackernews")).toBe(true);
    expect(isSparseSource("reddit")).toBe(true);
    expect(isSparseSource("lobsters")).toBe(true);
    expect(isSparseSource("stackoverflow")).toBe(true);
    expect(isSparseSource("devto")).toBe(true);
  });

  it("does not flag repos / package sources", () => {
    expect(isSparseSource("github")).toBe(false);
    expect(isSparseSource("npm")).toBe(false);
    expect(isSparseSource("pypi")).toBe(false);
    expect(isSparseSource("crates")).toBe(false);
    expect(isSparseSource("huggingface")).toBe(false);
  });
});

describe("getSourceConfig", () => {
  it("returns a config for every registered source", () => {
    const config = getSourceConfig("github");
    expect(config.name).toBe("GitHub");
    expect(config.category).toBe("repos");
  });
});
