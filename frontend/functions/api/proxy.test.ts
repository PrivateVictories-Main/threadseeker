import { describe, it, expect, vi, beforeEach } from "vitest";
import { onRequestGet } from "./proxy";

// The PagesFunction handlers take a context object; we only use request here.
const call = (target: string) => {
  const req = new Request(
    `https://ts.dev/api/proxy?url=${encodeURIComponent(target)}`,
  );
  return (onRequestGet as unknown as (c: { request: Request }) => Promise<Response>)({
    request: req,
  });
};

beforeEach(() => {
  vi.stubGlobal("caches", {
    default: { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("/api/proxy SSRF + content-type guards", () => {
  it("rejects a non-allowlisted host (400)", async () => {
    const r = await call("https://evil.example/data");
    expect(r.status).toBe(400);
  });

  it("rejects a non-https target (400)", async () => {
    const r = await call("http://hub.docker.com/v2/search/repositories");
    expect(r.status).toBe(400);
  });

  it("refuses to follow a redirect from an allowlisted host (502, no relay)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("", { status: 302, headers: { location: "https://evil.example" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await call("https://hub.docker.com/redirect");
    expect(r.status).toBe(502);
    // The redirect target body must never be relayed.
    expect(await r.text()).not.toContain("evil");
  });

  it("forces text/plain + attachment for a non-JSON (HTML) upstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<script>alert(1)</script>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    const r = await call("https://dev.to/feed");
    expect(r.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(r.headers.get("content-disposition")).toBe("attachment");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("passes a JSON upstream through as application/json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const r = await call("https://hex.pm/api/packages");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/json");
    expect(await r.json()).toEqual({ ok: 1 });
  });
});
