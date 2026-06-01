import { describe, it, expect } from "vitest";
import { SYNONYMS, expandQuery } from "./synonyms";

describe("SYNONYMS dictionary", () => {
  it("every entry has non-empty concept, triggers, expandTo", () => {
    for (const entry of SYNONYMS) {
      expect(entry.concept).toMatch(/^[a-z0-9-]+$/);
      expect(entry.triggers.length).toBeGreaterThan(0);
      expect(entry.expandTo.length).toBeGreaterThan(0);
      for (const trig of entry.triggers) expect(trig.length).toBeGreaterThan(1);
    }
  });

  it("concept ids are unique", () => {
    const ids = SYNONYMS.map((s) => s.concept);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("expandQuery", () => {
  it("returns raw terms when no synonym entry matches", () => {
    const result = expandQuery("acme-unknown-xyz");
    expect(result.expandedTerms).toEqual(["acme-unknown-xyz"]);
    expect(result.boostFullNames).toEqual([]);
  });

  it("expands 'react state management' to zustand/jotai/etc", () => {
    const result = expandQuery("react state management");
    expect(result.expandedTerms).toEqual(
      expect.arrayContaining(["zustand", "jotai", "redux"]),
    );
    expect(result.boostFullNames).toEqual(
      expect.arrayContaining(["pmndrs/zustand"]),
    );
  });

  it("respects `requires` — 'state management' alone does NOT trigger react entry", () => {
    const result = expandQuery("state management");
    expect(result.expandedTerms).not.toEqual(
      expect.arrayContaining(["zustand"]),
    );
  });

  it("expands 'mcp server' to MCP-related terms", () => {
    const result = expandQuery("mcp server for postgres");
    expect(result.expandedTerms).toEqual(
      expect.arrayContaining(["mcp", "model context protocol"]),
    );
  });

  it("dedupes expandedTerms", () => {
    const result = expandQuery("react state management state manager");
    const zustandCount = result.expandedTerms.filter((t) => t === "zustand").length;
    expect(zustandCount).toBe(1);
  });

  it("includes the user's original query tokens", () => {
    const result = expandQuery("vue pinia state");
    expect(result.expandedTerms).toEqual(expect.arrayContaining(["vue", "pinia", "state"]));
  });

  it("returns intent from classifyIntent", () => {
    expect(expandQuery("how to deploy next.js").intent).toBe("how_to");
  });
});

describe("expandQuery token-boundary matching (no substring false positives)", () => {
  it("'platform' does NOT trigger the 'orm' entry", () => {
    const result = expandQuery("web platform features");
    expect(result.expandedTerms).not.toEqual(
      expect.arrayContaining(["drizzle", "prisma"]),
    );
  });

  it("'storage' does NOT trigger the 'rag' entry", () => {
    const result = expandQuery("object storage server");
    expect(result.expandedTerms).not.toEqual(
      expect.arrayContaining(["llamaindex", "haystack"]),
    );
  });

  it("'google' substring does NOT satisfy the go-web `requires: [go]`", () => {
    const result = expandQuery("web framework for google cloud");
    expect(result.expandedTerms).not.toEqual(
      expect.arrayContaining(["gin", "echo", "fiber"]),
    );
  });

  it("single-token triggers still fire on an exact token", () => {
    const result = expandQuery("orm for typescript");
    expect(result.expandedTerms).toEqual(
      expect.arrayContaining(["prisma", "drizzle"]),
    );
  });

  it("naive plural tolerance — 'orms' still triggers the orm entry", () => {
    const result = expandQuery("typescript orms");
    expect(result.expandedTerms).toEqual(
      expect.arrayContaining(["prisma", "drizzle"]),
    );
  });
});

describe("SYNONYMS coverage", () => {
  it("has at least 45 concept entries", () => {
    expect(SYNONYMS.length).toBeGreaterThanOrEqual(45);
  });
});
