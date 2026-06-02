import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { UnifiedProject } from "@/lib/sources/types";

// Mock only the network boundary; keep the real ranking/merge/expansion so the
// hook exercises its true pipeline. The AI layer is forced off (null).
const searchAllSources = vi.fn();
vi.mock("@/lib/sources", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sources")>();
  return { ...actual, searchAllSources: (...a: unknown[]) => searchAllSources(...a) };
});
vi.mock("@/lib/api-client", () => ({
  optimizeQuery: vi.fn().mockResolvedValue(null),
  synthesizeResults: vi.fn().mockResolvedValue(null),
  rerankResults: vi.fn().mockResolvedValue(null),
}));

import { useSearch } from "./useSearch";
import { ALL_SOURCE_TYPES } from "@/lib/sources";

function corpus(prefix: string, n = 10): UnifiedProject[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${i}`,
    source: "github" as const,
    name: `${prefix}-${i}`,
    fullName: `owner/${prefix}-${i}`,
    description: `${prefix} project number ${i}`,
    url: `https://github.com/owner/${prefix}-${i}`,
    stars: 100 + i,
    language: "TypeScript",
    topics: [prefix],
    updatedAt: new Date().toISOString(),
    author: { name: "owner", avatar: "" },
  }));
}

const setup = () => {
  const resetView = vi.fn();
  const view = renderHook(() =>
    useSearch({ selectedSources: ALL_SOURCE_TYPES, resetView }),
  );
  return { ...view, resetView };
};

beforeEach(() => {
  searchAllSources.mockReset();
  sessionStorage.clear();
  localStorage.clear();
});

describe("useSearch", () => {
  it("runs a search and populates ranked projects", async () => {
    searchAllSources.mockResolvedValue(corpus("alpha"));
    const { result } = setup();

    await act(async () => {
      await result.current.handleSearch("alpha");
    });

    expect(result.current.hasSearched).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.query).toBe("alpha");
    expect(result.current.projects.length).toBe(10);
    expect(result.current.projects.every((p) => p.name.startsWith("alpha"))).toBe(true);
  });

  it("ignores a blank query", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.handleSearch("   ");
    });
    expect(result.current.hasSearched).toBe(false);
    expect(searchAllSources).not.toHaveBeenCalled();
  });

  it("a superseding search wins — the stale run's late result does not overwrite", async () => {
    let resolveFirst!: (v: UnifiedProject[]) => void;
    const firstPromise = new Promise<UnifiedProject[]>((r) => {
      resolveFirst = r;
    });
    searchAllSources
      .mockReturnValueOnce(firstPromise) // run 1 — hangs
      .mockResolvedValueOnce(corpus("beta")); // run 2 — resolves now

    const { result } = setup();

    // Start run 1 (do not await — it's in flight).
    let firstCall: Promise<void>;
    act(() => {
      firstCall = result.current.handleSearch("alpha");
    });

    // Run 2 supersedes and completes.
    await act(async () => {
      await result.current.handleSearch("beta");
    });
    expect(result.current.projects.every((p) => p.name.startsWith("beta"))).toBe(true);

    // Now the stale run 1 resolves late — its continuation must no-op.
    await act(async () => {
      resolveFirst(corpus("alpha"));
      await firstCall;
    });
    expect(result.current.projects.every((p) => p.name.startsWith("beta"))).toBe(true);
    expect(result.current.query).toBe("beta");
  });

  it("clearSearch resets result state", async () => {
    searchAllSources.mockResolvedValue(corpus("alpha"));
    const { result } = setup();
    await act(async () => {
      await result.current.handleSearch("alpha");
    });
    expect(result.current.projects.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearSearch();
    });
    await waitFor(() => expect(result.current.projects.length).toBe(0));
    expect(result.current.hasSearched).toBe(false);
    expect(result.current.query).toBe("");
  });

  it("records search history (deduped, capped)", async () => {
    searchAllSources.mockResolvedValue(corpus("alpha"));
    const { result } = setup();
    await act(async () => {
      await result.current.handleSearch("alpha");
    });
    await act(async () => {
      await result.current.handleSearch("beta");
    });
    await act(async () => {
      await result.current.handleSearch("alpha"); // dup -> moves to front, no duplicate
    });
    expect(result.current.history[0]).toBe("alpha");
    expect(result.current.history.filter((h) => h === "alpha").length).toBe(1);
  });
});
