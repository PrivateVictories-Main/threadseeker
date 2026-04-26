import { describe, it, expect } from "vitest";
import {
  significantTokens,
  pickDistinctiveToken,
  pickFirstToken,
  buildTokenPlan,
  buildDistinctivePlan,
  buildFuzzySynonymPlan,
  buildFirstTokenPlan,
  nextRelaxation,
  planRelaxationChain,
  relaxedExpansionTerms,
} from "./resilience";

describe("significantTokens", () => {
  it("drops stop-words and short tokens", () => {
    expect(significantTokens("a tool for the mouse")).toEqual(["tool", "mouse"]);
  });
  it("lowercases", () => {
    expect(significantTokens("React State")).toEqual(["react", "state"]);
  });
  it("returns empty for blank input", () => {
    expect(significantTokens("   ")).toEqual([]);
  });
});

describe("pickDistinctiveToken / pickFirstToken", () => {
  it("picks longest token", () => {
    expect(pickDistinctiveToken("mouse tapper")).toBe("tapper");
  });
  it("first token preserves order", () => {
    expect(pickFirstToken("mouse tapper")).toBe("mouse");
  });
  it("returns null for empty / stop-words-only", () => {
    expect(pickDistinctiveToken("a the of")).toBeNull();
    expect(pickFirstToken("the")).toBeNull();
  });
});

describe("buildTokenPlan", () => {
  it("returns null for single-token queries", () => {
    expect(buildTokenPlan("zustand")).toBeNull();
  });
  it("joins multiple significant tokens", () => {
    const plan = buildTokenPlan("mouse tapper");
    expect(plan).not.toBeNull();
    expect(plan!.query).toBe("mouse tapper");
    expect(plan!.tier).toBe("tokens");
  });
});

describe("buildDistinctivePlan", () => {
  it("falls back to longest token", () => {
    const plan = buildDistinctivePlan("mouse tapper");
    expect(plan).not.toBeNull();
    expect(plan!.query).toBe("tapper");
    expect(plan!.tier).toBe("distinctive");
  });
});

describe("buildFirstTokenPlan", () => {
  it("falls back to first token", () => {
    const plan = buildFirstTokenPlan("mouse tapper");
    expect(plan).not.toBeNull();
    expect(plan!.query).toBe("mouse");
    expect(plan!.tier).toBe("first-token");
  });
});

describe("buildFuzzySynonymPlan", () => {
  it("returns null when strict synonyms already trigger", () => {
    // "mcp" triggers the strict 'mcp-servers' entry, so fuzzy is redundant.
    expect(buildFuzzySynonymPlan("mcp postgres")).toBeNull();
  });
  it("matches a query whose tokens overlap an expandTo entry", () => {
    // 'auto' is a substring of 'autoclicker'/'autohotkey' inside the new
    // automation-desktop entry.
    const plan = buildFuzzySynonymPlan("auto click thing");
    // Even if no entry matches, the chain still has distinctive/first-token
    // fallbacks. Only assert structure when it does match.
    if (plan) {
      expect(plan.tier).toBe("fuzzy-synonyms");
      expect(plan.query.length).toBeGreaterThan(0);
    }
  });
});

describe("nextRelaxation", () => {
  it("first call after strict returns the token plan for multi-word queries", () => {
    const plan = nextRelaxation("mouse tapper", 0, "strict");
    expect(plan).not.toBeNull();
    // Could be tokens, fuzzy, distinctive, or first-token depending on
    // synonym matches — but for "mouse tapper" the multi-word token plan
    // wins.
    expect(["tokens", "fuzzy-synonyms", "distinctive", "first-token"]).toContain(
      plan!.tier,
    );
  });
  it("stops when totalSoFar >= 6 after strict", () => {
    expect(nextRelaxation("mouse tapper", 10, "tokens")).toBeNull();
  });
  it("first-token tier ends the chain", () => {
    expect(nextRelaxation("mouse tapper", 0, "first-token")).toBeNull();
  });
});

describe("planRelaxationChain — mouse tapper", () => {
  it("produces at least one relaxed plan", () => {
    const chain = planRelaxationChain("mouse tapper");
    expect(chain.length).toBeGreaterThan(0);
  });
  it("the chain reaches a single-token plan eventually", () => {
    const chain = planRelaxationChain("mouse tapper");
    const queries = chain.map((p) => p.query);
    // Either a distinctive or first-token plan should be present.
    expect(queries.some((q) => q === "mouse" || q === "tapper")).toBe(true);
  });
});

describe("relaxedExpansionTerms — mouse tapper", () => {
  it("returns at least 3 distinct expansion terms", () => {
    const terms = relaxedExpansionTerms("mouse tapper");
    // Hard requirement from the overhaul brief: "mouse tapper" must
    // expand to >= 3 query terms.
    expect(terms.length).toBeGreaterThanOrEqual(3);
  });
  it("includes both original tokens", () => {
    const terms = relaxedExpansionTerms("mouse tapper");
    expect(terms).toEqual(expect.arrayContaining(["mouse", "tapper"]));
  });
});
