import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SourceType } from "./types";

// Track concurrent in-flight adapters to prove the pool cap holds.
const tracker = vi.hoisted(() => ({
  inflight: 0,
  peak: 0,
  reset() {
    this.inflight = 0;
    this.peak = 0;
  },
}));

vi.mock("./adapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adapters")>();
  const make =
    (source: string, opts: { throws?: boolean } = {}) =>
    async () => {
      tracker.inflight++;
      tracker.peak = Math.max(tracker.peak, tracker.inflight);
      await new Promise((r) => setTimeout(r, 5));
      tracker.inflight--;
      if (opts.throws) throw new Error("boom");
      return {
        projects: [
          {
            id: `${source}-1`,
            source,
            name: source,
            fullName: `${source}/x`,
            description: "",
            url: "https://x.dev",
            stars: 0,
            language: null,
            topics: [],
            updatedAt: "",
            author: { name: "", avatar: "" },
          },
        ],
        totalCount: 1,
        source,
      };
    };
  return {
    ...actual,
    searchGitHub: make("github"),
    searchNpm: make("npm"),
    searchPyPI: make("pypi"),
    searchCrates: make("crates"),
    searchHackerNews: make("hackernews"),
    searchCodeberg: make("codeberg"),
    searchPackagist: make("packagist"),
    searchRubyGems: make("rubygems"),
    searchReddit: make("reddit"),
    searchDockerHub: make("dockerhub"),
    searchGitLab: make("gitlab", { throws: true }),
  };
});

import { searchAllSources } from "./index";

const TEN: SourceType[] = [
  "github", "npm", "pypi", "crates", "hackernews",
  "codeberg", "packagist", "rubygems", "reddit", "dockerhub",
];

beforeEach(() => tracker.reset());

describe("searchAllSources orchestrator", () => {
  it("returns every source's projects, runs in parallel, and never exceeds the concurrency cap (8)", async () => {
    const events: Array<{ done: boolean; remaining: number }> = [];
    const all = await searchAllSources("q", TEN, false, {}, (e) =>
      events.push({ done: e.done, remaining: e.remaining }),
    );
    expect(all.length).toBe(10);
    expect(tracker.peak).toBeGreaterThan(1); // genuinely concurrent
    expect(tracker.peak).toBeLessThanOrEqual(8); // but capped
    // onProgress streams once per source, decrementing remaining to 0 + done.
    expect(events.length).toBe(10);
    expect(events[events.length - 1]).toEqual({ done: true, remaining: 0 });
  });

  it("isolates a throwing source — the others still return", async () => {
    const events: Array<{ source: string; error?: string }> = [];
    const all = await searchAllSources("q", ["gitlab", "npm"], false, {}, (e) =>
      events.push({ source: e.source, error: e.error }),
    );
    // gitlab threw → contributes nothing; npm still returns.
    expect(all.map((p) => p.source)).toEqual(["npm"]);
    expect(events.find((e) => e.source === "gitlab")?.error).toBeTruthy();
  });

  it("applies per-source query overrides", async () => {
    // Override doesn't change the mock output, but the call must not throw and
    // must still return both sources (smoke for the overrides path).
    const all = await searchAllSources("q", ["github", "npm"], false, {
      github: "react OR state",
    });
    expect(all.length).toBe(2);
  });
});
