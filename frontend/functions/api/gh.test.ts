import { describe, it, expect, vi, beforeEach } from "vitest";
import { onRequestGet } from "./gh";

const call = (target: string, env: { GITHUB_TOKEN?: string } = {}) => {
  const req = new Request(`https://ts.dev/api/gh?url=${encodeURIComponent(target)}`);
  return (
    onRequestGet as unknown as (c: {
      request: Request;
      env: { GITHUB_TOKEN?: string };
    }) => Promise<Response>
  )({ request: req, env });
};

let put: ReturnType<typeof vi.fn>;
beforeEach(() => {
  put = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("caches", { default: { match: vi.fn().mockResolvedValue(undefined), put } });
});

describe("/api/gh allowlist + redirect + token handling", () => {
  it("rejects any host other than api.github.com (400)", async () => {
    const r = await call("https://evil.example/repos");
    expect(r.status).toBe(400);
  });

  it("refuses to follow a redirect (502) — the token-exfil guard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 302, headers: { location: "https://codeload.github.com/x" } })),
    );
    const r = await call("https://api.github.com/repos/a/b/tarball");
    expect(r.status).toBe(502);
  });

  it("does NOT attach an Authorization header when no token is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await call("https://api.github.com/search/repositories?q=react");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    // redirect:"manual" must be set (the SSRF/exfil guard).
    expect(init.redirect).toBe("manual");
  });

  it("attaches a Bearer token when GITHUB_TOKEN is set, and caches the OK response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await call("https://api.github.com/search/repositories?q=react", { GITHUB_TOKEN: "secret-tok" });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-tok");
    expect(r.status).toBe(200);
    expect(put).toHaveBeenCalledOnce();
  });
});
