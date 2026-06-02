import { describe, it, expect } from "vitest";
import { rankCorpus } from "./ranking-bm25";
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
