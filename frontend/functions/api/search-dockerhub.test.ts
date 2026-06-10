import { describe, it, expect, vi, beforeEach } from "vitest";

// The relay's JWT + result caching go through caches.default, so each test
// stubs a fresh no-op cache and takes a fresh module (same idiom as the
// vcpkg/melpa function tests).
type Handler = (c: {
  request: Request;
  env: Record<string, string | undefined>;
}) => Promise<Response>;

async function freshHandler(): Promise<Handler> {
  vi.resetModules();
  const mod = await import("./search-dockerhub");
  return mod.onRequestPost as unknown as Handler;
}

const post = (handler: Handler, body: unknown, env: Record<string, string | undefined> = {}) =>
  handler({
    request: new Request("https://ts.dev/api/search-dockerhub", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
  });

const HIT = {
  results: [
    { repo_name: "library/nginx", short_description: "Official build of Nginx.", star_count: 20000, pull_count: 1000000, is_official: true },
  ],
};

beforeEach(() => {
  vi.stubGlobal("caches", {
    default: { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("/api/search-dockerhub relay", () => {
  it("keyless: searches unauthenticated (no login call, no Authorization header)", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/v2/search/repositories")) {
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBeNull();
        return new Response(JSON.stringify(HIT), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch: ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const handler = await freshHandler();
    const res = await post(handler, { query: "nginx" });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { results: unknown[] };
    expect(data.results).toHaveLength(1);
    // login endpoint must never be called without credentials
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("users/login"))).toBe(false);
  });

  it("credentialed: mints a JWT via users/login and sends Bearer on the search", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/v2/users/login")) {
        const body = JSON.parse(String(init?.body));
        expect(body).toEqual({ username: "ryan", password: "dckr_pat_x" });
        return new Response(JSON.stringify({ token: "jwt-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/v2/search/repositories")) {
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBe("Bearer jwt-123");
        return new Response(JSON.stringify(HIT), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch: ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const handler = await freshHandler();
    const res = await post(handler, { query: "nginx" }, {
      DOCKERHUB_USERNAME: "ryan",
      DOCKERHUB_TOKEN: "dckr_pat_x",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { results: unknown[] };
    expect(data.results).toHaveLength(1);
  });

  it("upstream 429 (the keyless production reality) serves empty WITHOUT edge-caching it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ detail: "Rate limit exceeded" }), { status: 429 }),
    ));
    const handler = await freshHandler();
    const res = await post(handler, { query: "nginx" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const data = (await res.json()) as { results: unknown[] };
    expect(data.results).toEqual([]);
  });

  it("failed login degrades to the unauthenticated search instead of erroring", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/v2/users/login")) return new Response("nope", { status: 401 });
      if (u.includes("/v2/search/repositories")) {
        const headers = new Headers(init?.headers);
        expect(headers.get("Authorization")).toBeNull();
        return new Response(JSON.stringify(HIT), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch: ${u}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const handler = await freshHandler();
    const res = await post(handler, { query: "nginx" }, {
      DOCKERHUB_USERNAME: "ryan",
      DOCKERHUB_TOKEN: "bad",
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { results: unknown[] };
    expect(data.results).toHaveLength(1);
  });

  it("malformed body → 400", async () => {
    const handler = await freshHandler();
    const res = await post(handler, "{not json");
    expect(res.status).toBe(400);
  });
});
