import { describe, it, expect } from "vitest";
import { getSuggestions } from "./suggestions";

describe("getSuggestions", () => {
  it("returns prefix matches before substring matches, capped", () => {
    const out = getSuggestions("react", [], 5);
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out[0].text.toLowerCase().startsWith("react")).toBe(true);
    expect(out.every((s) => s.text.toLowerCase().includes("react"))).toBe(true);
  });

  it("surfaces matching recent history first, tagged 'recent'", () => {
    const out = getSuggestions("vec", ["vector search tuning"], 6);
    expect(out[0]).toEqual({ text: "vector search tuning", kind: "recent" });
    // curated "vector database" still appears as a suggestion
    expect(out.some((s) => s.text === "vector database" && s.kind === "suggestion")).toBe(true);
  });

  it("excludes the exact current input and de-dupes case-insensitively", () => {
    const out = getSuggestions("vector database", ["Vector Database"], 6);
    expect(out.some((s) => s.text.toLowerCase() === "vector database")).toBe(false);
  });

  it("empty input returns recent history then curated starters", () => {
    const out = getSuggestions("", ["my recent query"], 4);
    expect(out[0]).toEqual({ text: "my recent query", kind: "recent" });
    expect(out.length).toBe(4);
  });

  it("returns nothing-matching gracefully", () => {
    const out = getSuggestions("zzzznomatch", []);
    expect(out).toEqual([]);
  });
});
