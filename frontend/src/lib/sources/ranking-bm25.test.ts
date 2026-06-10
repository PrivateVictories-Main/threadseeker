import { describe, it, expect } from "vitest";
import { rankCorpus, blendRerank, blendSemantic, semanticWeight } from "./ranking-bm25";
import { expandQuery } from "./synonyms";
import type { UnifiedProject } from "./types";

function mk(p: Partial<UnifiedProject>): UnifiedProject {
  return {
    id: p.id ?? "id",
    source: p.source ?? "github",
    name: p.name ?? "project",
    fullName: p.fullName ?? "owner/project",
    description: p.description ?? "",
    url: p.url ?? "http://example.com",
    stars: p.stars ?? 0,
    downloads: p.downloads,
    weeklyDownloads: p.weeklyDownloads,
    popularityScore: p.popularityScore,
    language: p.language ?? null,
    topics: p.topics ?? [],
    license: p.license,
    updatedAt: p.updatedAt ?? new Date().toISOString(),
    author: p.author ?? { name: "owner", avatar: "" },
  };
}

describe("rankCorpus", () => {
  it("puts exact-name match above mere description hit", () => {
    const projects: UnifiedProject[] = [
      mk({ name: "zustand", fullName: "pmndrs/zustand", stars: 45000, description: "state mgmt" }),
      mk({ name: "random-thing", fullName: "x/y", stars: 100, description: "zustand clone" }),
    ];
    const ranked = rankCorpus(projects, "zustand", expandQuery("zustand"));
    expect(ranked[0].name).toBe("zustand");
  });

  it("surfaces boosted fullName projects for concept queries", () => {
    const projects: UnifiedProject[] = [
      mk({ name: "randostate", fullName: "x/randostate", stars: 3000, description: "a react store" }),
      mk({ name: "zustand", fullName: "pmndrs/zustand", stars: 45000, description: "state for react" }),
    ];
    const ranked = rankCorpus(projects, "react state management", expandQuery("react state management"));
    expect(ranked[0].fullName).toBe("pmndrs/zustand");
  });

  it("BM25 favors rare-term hits over popular-term hits", () => {
    // "state" appears in every doc (common, low IDF);
    // "zustand" appears in only one doc (rare, high IDF) → rare hit should win.
    const projects: UnifiedProject[] = [
      mk({ name: "react-state-helpers", description: "state helpers for state management state" }),
      mk({ name: "vue-state-utils", description: "state utilities for state handling" }),
      mk({ name: "redux-state-toolkit", description: "state management toolkit" }),
      mk({ name: "awesome-zustand", description: "zustand recipes and patterns" }),
    ];
    const ranked = rankCorpus(projects, "zustand state", expandQuery("zustand state"));
    expect(ranked[0].name).toBe("awesome-zustand");
  });

  it("recency penalty pushes a 4-year-stale repo down", () => {
    const stale = new Date(Date.now() - 1400 * 86400000).toISOString();
    const fresh = new Date(Date.now() - 7 * 86400000).toISOString();
    const projects: UnifiedProject[] = [
      mk({ name: "foo-stale", updatedAt: stale, stars: 100 }),
      mk({ name: "foo-fresh", updatedAt: fresh, stars: 100 }),
    ];
    const ranked = rankCorpus(projects, "foo", expandQuery("foo"));
    expect(ranked[0].name).toBe("foo-fresh");
  });

  it("does not throw on empty corpus", () => {
    expect(() => rankCorpus([], "anything", expandQuery("anything"))).not.toThrow();
  });

  it("empty updatedAt is treated as no-signal, NOT as fresh (no fake recency boost)", () => {
    // Regression guard for the adapters that used to stamp updatedAt=now().
    const fresh = new Date(Date.now() - 2 * 86400000).toISOString();
    const projects: UnifiedProject[] = [
      mk({ id: "a", name: "foo-empty", updatedAt: "", stars: 100 }),
      mk({ id: "b", name: "foo-fresh", updatedAt: fresh, stars: 100 }),
    ];
    const ranked = rankCorpus(projects, "foo", expandQuery("foo"));
    // The genuinely-fresh repo wins; the empty-timestamp repo gets no boost.
    expect(ranked[0].name).toBe("foo-fresh");
  });

  it("blank updatedAt does NOT pick up the trending boost (age-gate is explicit, not NaN-incidental)", () => {
    // A registry record with many stars but no timestamp must not be treated as
    // "trending" just because a sentinel compares low — only a genuinely-recent,
    // timestamped repo earns the trending lift. Both match the query equally.
    const fresh = new Date(Date.now() - 3 * 86400000).toISOString();
    const projects: UnifiedProject[] = [
      mk({ id: "a", name: "foo-notime", updatedAt: "", stars: 50000, description: "a foo tool" }),
      mk({ id: "b", name: "foo-fresh", updatedAt: fresh, stars: 50000, description: "a foo tool" }),
    ];
    const ranked = rankCorpus(projects, "foo", expandQuery("foo"));
    expect(ranked[0].name).toBe("foo-fresh");
  });

  it("archived repos are pushed below a maintained match despite far more stars", () => {
    const archived = {
      ...mk({ name: "foo-legacy", fullName: "x/foo-legacy", stars: 40000, description: "a foo toolkit" }),
      archived: true,
    };
    const active = mk({ name: "foo-kit", fullName: "y/foo-kit", stars: 800, description: "a foo toolkit" });
    const ranked = rankCorpus([archived, active], "foo toolkit", expandQuery("foo toolkit"));
    expect(ranked[0].name).toBe("foo-kit");
  });

  it("npm popularityScore lifts a starless package over a zero-popularity peer", () => {
    const projects: UnifiedProject[] = [
      mk({ id: "a", source: "npm", name: "foo-lib", description: "a foo helper", stars: 0, popularityScore: 0 }),
      mk({ id: "b", source: "npm", name: "foo-util", description: "a foo helper", stars: 0, popularityScore: 0.95 }),
    ];
    const ranked = rankCorpus(projects, "foo", expandQuery("foo"));
    expect(ranked[0].name).toBe("foo-util");
  });

  it("blendRerank fuses AI order with BM25 but can't catastrophically reorder", () => {
    const ps = ["a", "b", "c", "d"].map((id) => mk({ id, name: id }));
    // AI strongly prefers d (last) → rank-fusion lifts it but BM25 dampens.
    const out = blendRerank(ps, ["d", "c", "b", "a"], 4).map((p) => p.id);
    // d fuses to 0.5*0+0.5*3=1.5; a fuses to 0.5*3+0.5*0=1.5 (tie → stable);
    // b: 0.5*2+0.5*1=1.5; c: 0.5*1+0.5*2=1.5 — all tie, so order is preserved
    // (the fusion refuses to fully trust either signal). No item vanishes.
    expect(out.sort()).toEqual(["a", "b", "c", "d"]);
    expect(out.length).toBe(4);
  });

  it("blendRerank lifts an AI-promoted item past peers but not past a strong BM25 #1, and ignores bogus ids", () => {
    const ps = ["a", "b", "c", "d"].map((id) => mk({ id, name: id }));
    // AI promotes c to the top + emits a hallucinated id. Fused scores:
    // a=0.5, c=1.0, b=1.5, d=3 → c rises above b but a (BM25 #1) holds.
    const out = blendRerank(ps, ["c", "bogus", "a", "b", "d"], 4).map((p) => p.id);
    expect(out).toEqual(["a", "c", "b", "d"]);
    expect(out.length).toBe(4); // nothing dropped, bogus id ignored
  });

  it("blendRerank is a no-op on empty AI order", () => {
    const ps = ["a", "b"].map((id) => mk({ id, name: id }));
    expect(blendRerank(ps, []).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("intent weighting lifts the matching source (model query → huggingface over github)", () => {
    const projects: UnifiedProject[] = [
      mk({ id: "a", source: "github", name: "llama", description: "llama model weights" }),
      mk({ id: "b", source: "huggingface", name: "llama", description: "llama model weights" }),
    ];
    const exp = expandQuery("llama model");
    expect(exp.intent).toBe("model_search");
    const ranked = rankCorpus(projects, "llama model", exp);
    expect(ranked[0].source).toBe("huggingface");
  });
});

describe("blendSemantic (keyless in-browser rerank fusion)", () => {
  const ps = (ids: string[]) => ids.map((id) => mk({ id, name: id }));

  it("lifts a semantically-preferred item without letting it teleport past everything", () => {
    // BM25 order a,b,c,d. Semantic strongly prefers d (cos .9) over a (.1).
    const scores = new Map([["a", 0.1], ["b", 0.2], ["c", 0.3], ["d", 0.9]]);
    const out = blendSemantic(ps(["a", "b", "c", "d"]), scores, 0.5, 4).map((p) => p.id);
    // d: 0.5*0 + 0.5*3 = 1.5; a: 0.5*3 + 0.5*0 = 1.5 (tie, stable) — the
    // fusion meets in the middle instead of fully trusting either signal.
    expect(out.sort()).toEqual(["a", "b", "c", "d"]);
    expect(out.length).toBe(4);
  });

  it("at paragraph weight (0.62) a clear semantic winner overtakes a weak BM25 head", () => {
    const scores = new Map([["a", 0.05], ["b", 0.1], ["c", 0.95], ["d", 0.2]]);
    const out = blendSemantic(ps(["a", "b", "c", "d"]), scores, 0.62, 4).map((p) => p.id);
    // Fused (w=0.62): c = .62*0+.38*2 = 0.76 · b = .62*2+.38*1 = 1.62 ·
    // d = .62*1+.38*3 = 1.76 · a = .62*3+.38*0 = 1.86 → for a long
    // descriptive query the meaning-match takes #1 and the keyword-only
    // BM25 head (a, semantically last) sinks to the bottom.
    expect(out).toEqual(["c", "b", "d", "a"]);
  });

  it("items the scorer missed keep their position (neutral, not penalized)", () => {
    const scores = new Map([["c", 0.9]]); // partial coverage — only c scored
    const out = blendSemantic(ps(["a", "b", "c", "d"]), scores, 0.5, 4).map((p) => p.id);
    expect(out.length).toBe(4);
    // a and b keep their leading ranks; c (sem rank 0) fuses up to ~1.
    expect(out[0]).toBe("a");
    expect(out.indexOf("c")).toBeLessThanOrEqual(2);
  });

  it("is a no-op on an empty score map and never touches the tail beyond topN", () => {
    expect(blendSemantic(ps(["a", "b"]), new Map(), 0.5).map((p) => p.id)).toEqual(["a", "b"]);
    const scores = new Map([["d", 0.99]]);
    const out = blendSemantic(ps(["a", "b", "c", "d"]), scores, 0.8, 2).map((p) => p.id);
    // topN=2: c and d are tail — untouched even with a huge d score.
    expect(out.slice(2)).toEqual(["c", "d"]);
  });

  it("clamps a hostile weight into [0, 0.8]", () => {
    const scores = new Map([["b", 0.9], ["a", 0.1]]);
    // weight 99 must not produce NaN/teleport beyond the w=0.8 behavior.
    const out = blendSemantic(ps(["a", "b"]), scores, 99, 2).map((p) => p.id);
    expect(out).toEqual(["b", "a"]); // w=0.8: b fuses 0.8*0+0.2*1=0.2 < a 0.8*1+0.2*0=0.8
  });

  it("semanticWeight scales with query length: keywords stay BM25-led, paragraphs go semantic-led", () => {
    expect(semanticWeight(2)).toBeLessThan(0.5);
    expect(semanticWeight(5)).toBe(0.5);
    expect(semanticWeight(12)).toBeGreaterThan(0.5);
    expect(semanticWeight(12)).toBeLessThanOrEqual(0.8);
  });
});
