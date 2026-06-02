import { describe, it, expect, vi, afterEach } from "vitest";
import { optimizeQuery, synthesizeResults } from "./api-client";

const jsonRes = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => vi.restoreAllMocks());

// These guard the "AI degrades to deterministic" contract: any failure / no-key
// / missing-function must yield null so the caller falls back, never throws.
describe("optimizeQuery", () => {
  it("returns null on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(500, {})));
    expect(await optimizeQuery("x")).toBeNull();
  });
  it("returns null when the layer is disabled (no key)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(200, { disabled: true })));
    expect(await optimizeQuery("x")).toBeNull();
  });
  it("returns null when keyTerms is empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(200, { keyTerms: [] })));
    expect(await optimizeQuery("x")).toBeNull();
  });
  it("returns keyTerms + intent on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      jsonRes(200, { keyTerms: ["react", "state"], intent: "project_search" }),
    ));
    const r = await optimizeQuery("x");
    expect(r?.keyTerms).toEqual(["react", "state"]);
    expect(r?.intent).toBe("project_search");
  });
  it("returns null on a network throw", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network");
    }));
    expect(await optimizeQuery("x")).toBeNull();
  });
});

describe("synthesizeResults", () => {
  const projects = [{ name: "a", source: "github", description: "d", stars: 1 }];
  it("returns null when disabled", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(200, { disabled: true })));
    expect(await synthesizeResults("q", projects)).toBeNull();
  });
  it("returns null on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(503, {})));
    expect(await synthesizeResults("q", projects)).toBeNull();
  });
  it("returns the verdict string on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(200, { verdict: "Use X." })));
    expect(await synthesizeResults("q", projects)).toBe("Use X.");
  });
});
