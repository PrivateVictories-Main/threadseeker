import { describe, it, expect } from "vitest";
import { SYNONYMS } from "./synonyms";

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
