import { describe, it, expect, vi, beforeEach } from "vitest";

// search-melpa keeps a module-level isolate cache of the parsed+joined index,
// so every test takes a FRESH module instance (vi.resetModules + dynamic
// import) — otherwise the happy-path test would pre-warm the cache and the
// failure-path tests would never reach their failing fetches.
type Handler = (c: { request: Request }) => Promise<Response>;
async function freshHandler(): Promise<Handler> {
  vi.resetModules();
  const mod = await import("./search-melpa");
  return mod.onRequestPost as unknown as Handler;
}

const post = (handler: Handler, body: unknown) =>
  handler({
    request: new Request("https://ts.dev/api/search-melpa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });

// Raw upstream shapes (curl-verified 2026-06-10):
// archive.json — {"<name>": { ver:[date,time], deps, desc, type, props }}
const ARCHIVE = {
  magit: {
    ver: [20260609, 956],
    deps: { emacs: [28, 1] },
    desc: "A Git porcelain inside Emacs",
    type: "tar",
    props: {
      url: "https://github.com/magit/magit",
      commit: "9fa5e22622c3917b52039994ced8c57157bebcfe",
      keywords: ["git", "tools", "vc"],
    },
  },
  "magit-section": {
    ver: [20260530, 1230],
    deps: null,
    desc: "Sections for read-only buffers",
    type: "tar",
    props: { url: "https://github.com/magit/magit" },
  },
  vertico: {
    ver: [20260605, 1903],
    deps: { emacs: [28, 1] },
    desc: "VERTical Interactive COmpletion",
    type: "tar",
    props: {
      url: "https://github.com/minad/vertico",
      keywords: ["convenience", "files", "matching", "completion"],
    },
  },
};
// download_counts.json — {"<name>": count}. vertico deliberately absent to
// pin the missing-count → 0 behavior.
const COUNTS = { magit: 5_176_602, "magit-section": 5_400_000 };

// Substring-routed fetch stub so archive + counts can succeed/fail
// independently within one test.
const routeFetch = (routes: Record<string, () => Promise<Response>>) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      for (const [fragment, respond] of Object.entries(routes)) {
        if (url.includes(fragment)) return respond();
      }
      return new Response("not found", { status: 404 });
    }),
  );
};
const ok = (body: unknown) => async () =>
  new Response(JSON.stringify(body), { status: 200 });
const boom = () => async (): Promise<Response> => {
  throw new TypeError("network down");
};

let put: ReturnType<typeof vi.fn>;
beforeEach(() => {
  put = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("caches", {
    default: { match: vi.fn().mockResolvedValue(undefined), put },
  });
});

describe("/api/search-melpa", () => {
  it("filters the archive and joins download counts by name", async () => {
    routeFetch({
      "archive.json": ok(ARCHIVE),
      "download_counts.json": ok(COUNTS),
    });
    const handler = await freshHandler();
    const r = await post(handler, { query: "magit" });
    expect(r.status).toBe(200);
    const { results } = (await r.json()) as { results: any[] };
    // Exact name first, prefix match second; vertico doesn't match.
    expect(results.map((p) => p.name)).toEqual(["magit", "magit-section"]);
    // The Promise.all join: counts keyed by name land in `downloads`.
    expect(results[0].downloads).toBe(5_176_602);
    expect(results[1].downloads).toBe(5_400_000);
    // ver [20260609, 956] → "20260609.956" + a real ISO build date.
    expect(results[0].version).toBe("20260609.956");
    expect(results[0].updated).toBe("2026-06-09T00:00:00.000Z");
    // props.url is the upstream repo; keywords pass through.
    expect(results[0].repo).toBe("https://github.com/magit/magit");
    expect(results[0].keywords).toEqual(["git", "tools", "vc"]);
    // A real success is edge-cached for the query TTL.
    expect(put).toHaveBeenCalledOnce();
    expect(r.headers.get("Cache-Control")).toContain("max-age=1800");
  });

  it("maps a package missing from download_counts.json to downloads 0", async () => {
    routeFetch({
      "archive.json": ok(ARCHIVE),
      "download_counts.json": ok(COUNTS),
    });
    const handler = await freshHandler();
    const r = await post(handler, { query: "vertico" });
    const { results } = (await r.json()) as { results: any[] };
    expect(results[0].name).toBe("vertico");
    expect(results[0].downloads).toBe(0);
  });

  it("serves empty WITHOUT caching when the archive fetch fails (Uncacheable)", async () => {
    routeFetch({
      "archive.json": boom(),
      "download_counts.json": ok(COUNTS),
    });
    const handler = await freshHandler();
    const r = await post(handler, { query: "magit" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ results: [] });
    // Transient failure must not pin an empty result into the edge cache.
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(put).not.toHaveBeenCalled();
  });

  it("still serves (and caches) results when only the counts fetch fails", async () => {
    routeFetch({
      "archive.json": ok(ARCHIVE),
      "download_counts.json": boom(),
    });
    const handler = await freshHandler();
    const r = await post(handler, { query: "magit" });
    expect(r.status).toBe(200);
    const { results } = (await r.json()) as { results: any[] };
    // Counts are enrichment, not a gate — results flow with downloads 0.
    expect(results.map((p) => p.name)).toEqual(["magit", "magit-section"]);
    expect(results[0].downloads).toBe(0);
    expect(put).toHaveBeenCalledOnce();
  });

  it("rejects a malformed (non-JSON) body with 400", async () => {
    const handler = await freshHandler();
    const r = await post(handler, "not json {{");
    expect(r.status).toBe(400);
  });

  it("rejects a missing/blank query with 400", async () => {
    const handler = await freshHandler();
    expect((await post(handler, {})).status).toBe(400);
    expect((await post(handler, { query: "" })).status).toBe(400);
  });
});
