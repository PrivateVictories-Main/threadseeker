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
    language: p.language ?? null,
    topics: p.topics ?? [],
    license: p.license ?? null,
    updatedAt: p.updatedAt ?? new Date().toISOString(),
    avatarUrl: p.avatarUrl ?? null,
  } as UnifiedProject;
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
});
