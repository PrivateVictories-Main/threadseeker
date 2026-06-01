import { describe, it, expect } from "vitest";
import { buildSearchQuery, coreSearchQuery } from "./index";
import { expandQuery } from "./synonyms";

describe("buildSearchQuery", () => {
  it("returns the raw query unchanged for non-OR sources", () => {
    const q = "react state management";
    expect(buildSearchQuery(q, expandQuery(q), { supportsOr: false })).toBe(q);
  });

  it("OR-joins content tokens with curated synonym expansions", () => {
    const q = "react state management";
    const built = buildSearchQuery(q, expandQuery(q), { supportsOr: true });
    expect(built).toContain(" OR ");
    // The query's own tokens are present...
    expect(built).toMatch(/react/);
    expect(built).toMatch(/state/);
    // ...and at least one curated synonym (zustand/jotai/redux).
    expect(built).toMatch(/zustand|jotai|redux/);
    // Capped to 6 OR-terms.
    expect(built.split(" OR ").length).toBeLessThanOrEqual(6);
  });

  it("for a long paragraph, the OR query stays focused on key terms (no filler)", () => {
    const long =
      "I am looking for an open source library that helps me manage global " +
      "state in a react application with typescript support";
    const fetchQuery = coreSearchQuery(long);
    const built = buildSearchQuery(fetchQuery, expandQuery(long), { supportsOr: true });
    expect(built.split(" OR ").length).toBeLessThanOrEqual(6);
    expect(built).not.toMatch(/\blooking\b|\bfor\b/);
    expect(built).toMatch(/react|state|typescript/);
  });
});
