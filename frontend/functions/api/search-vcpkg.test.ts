import { describe, it, expect, vi, beforeEach } from "vitest";

// search-vcpkg keeps a module-level isolate cache of the parsed index, so
// every test takes a FRESH module instance (vi.resetModules + dynamic import)
// — otherwise the happy-path test would pre-warm the cache and the
// transient-failure test would never reach its failing fetch.
type Handler = (c: { request: Request }) => Promise<Response>;
async function freshHandler(): Promise<Handler> {
  vi.resetModules();
  const mod = await import("./search-vcpkg");
  return mod.onRequestPost as unknown as Handler;
}

const post = (handler: Handler, body: unknown) =>
  handler({
    request: new Request("https://ts.dev/api/search-vcpkg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });

// Raw upstream index shape (https://vcpkg.io/output.json, curl-verified
// 2026-06-10): note the LOWERCASE `homepage`, the string Description on fmt,
// and the ARRAY-of-paragraphs Description on abseil — both live shapes.
const INDEX = {
  Baseline: "cde4530",
  Size: 4,
  Source: [
    {
      Name: "fmt",
      Version: "12.1.0",
      "Port-Version": 0,
      Description:
        "{fmt} is an open-source formatting library providing a fast and safe alternative to C stdio and C++ iostreams.",
      homepage: "https://github.com/fmtlib/fmt",
      License: "MIT",
      LastModified: "2025-10-31",
    },
    {
      Name: "abseil",
      Version: "20260107.1",
      Description: [
        "Abseil is an open-source collection of C++ library code designed to augment the C++ standard library.",
        "In some cases, Abseil provides pieces missing from the C++ standard.",
      ],
      homepage: "https://github.com/abseil/abseil-cpp",
      License: "Apache-2.0",
      LastModified: "2026-05-21",
      Supports: "!uwp",
    },
    {
      // Port with no Description / homepage / License — maps, never throws.
      Name: "fmtlog",
      Version: "2.3.0",
      LastModified: "2026-01-15",
    },
    {
      // Nameless junk row — must be filtered out during parse.
      Version: "0.0.1",
      Description: "ghost entry",
    },
  ],
};

let put: ReturnType<typeof vi.fn>;
beforeEach(() => {
  put = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("caches", {
    default: { match: vi.fn().mockResolvedValue(undefined), put },
  });
});

describe("/api/search-vcpkg", () => {
  it("filters + scores the index; joins array Descriptions; caches the hit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(INDEX), { status: 200 })),
    );
    const handler = await freshHandler();
    const r = await post(handler, { query: "fmt" });
    expect(r.status).toBe(200);
    const { results } = (await r.json()) as { results: any[] };
    // fmt (exact name) outranks fmtlog (prefix); abseil doesn't match "fmt".
    expect(results.map((p) => p.name)).toEqual(["fmt", "fmtlog"]);
    expect(results[0].version).toBe("12.1.0");
    expect(results[0].license).toBe("MIT");
    // Lowercase `homepage` from the live index is the one that's read.
    expect(results[0].homepage).toBe("https://github.com/fmtlib/fmt");
    // LastModified ("YYYY-MM-DD") ships as a real ISO timestamp.
    expect(results[0].updated).toBe("2025-10-31T00:00:00.000Z");
    // Missing optional fields map to nulls/"" — present, not undefined-holes.
    expect(results[1].desc).toBeNull();
    expect(results[1].homepage).toBeNull();
    // A real success is edge-cached for the query TTL.
    expect(put).toHaveBeenCalledOnce();
    expect(r.headers.get("Cache-Control")).toContain("max-age=1800");
  });

  it("joins an ARRAY Description into one string (abseil shape)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(INDEX), { status: 200 })),
    );
    const handler = await freshHandler();
    const r = await post(handler, { query: "abseil" });
    const { results } = (await r.json()) as { results: any[] };
    expect(results[0].name).toBe("abseil");
    expect(typeof results[0].desc).toBe("string");
    expect(results[0].desc).toBe(
      "Abseil is an open-source collection of C++ library code designed to augment the C++ standard library. " +
        "In some cases, Abseil provides pieces missing from the C++ standard.",
    );
  });

  it("serves empty WITHOUT caching on a network failure (Uncacheable)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    const handler = await freshHandler();
    const r = await post(handler, { query: "fmt" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ results: [] });
    // Transient failure must not pin an empty result into the edge cache.
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(put).not.toHaveBeenCalled();
  });

  it("serves empty WITHOUT caching on an upstream 5xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream sad", { status: 503 })),
    );
    const handler = await freshHandler();
    const r = await post(handler, { query: "fmt" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ results: [] });
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects a malformed (non-JSON) body with 400", async () => {
    const handler = await freshHandler();
    const r = await post(handler, "not json {{");
    expect(r.status).toBe(400);
  });

  it("rejects a missing/blank query with 400", async () => {
    const handler = await freshHandler();
    expect((await post(handler, {})).status).toBe(400);
    expect((await post(handler, { query: "   " })).status).toBe(400);
  });
});
