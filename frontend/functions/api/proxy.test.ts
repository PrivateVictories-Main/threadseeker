import { describe, it, expect, vi, beforeEach } from "vitest";
import { onRequestGet, onRequestPost } from "./proxy";

// The PagesFunction handlers take a context object; we only use request here.
const call = (target: string) => {
  const req = new Request(
    `https://ts.dev/api/proxy?url=${encodeURIComponent(target)}`,
  );
  return (onRequestGet as unknown as (c: { request: Request }) => Promise<Response>)({
    request: req,
  });
};

const callPost = (target: string, body: string) => {
  const req = new Request(
    `https://ts.dev/api/proxy?url=${encodeURIComponent(target)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body },
  );
  return (onRequestPost as unknown as (c: { request: Request }) => Promise<Response>)({
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

describe("/api/proxy POST passthrough (flathub-only)", () => {
  it("relays a JSON POST to the allowlisted host with the body intact", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ hits: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await callPost(
      "https://flathub.org/api/v2/search",
      JSON.stringify({ query: "vlc", filters: [] }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/json");
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(JSON.parse(init.body)).toEqual({ query: "vlc", filters: [] });
  });

  it("rejects POST to a GET-only allowlisted host (400)", async () => {
    // hub.docker.com is on the GET allowlist but NOT the POST allowlist —
    // POST must stay locked to the hosts that genuinely require it.
    const r = await callPost("https://hub.docker.com/v2/anything", "{}");
    expect(r.status).toBe(400);
  });

  it("rejects POST to a non-allowlisted host (400)", async () => {
    const r = await callPost("https://evil.example/api", "{}");
    expect(r.status).toBe(400);
  });

  it("rejects a non-JSON body (400)", async () => {
    const r = await callPost("https://flathub.org/api/v2/search", "not json {{");
    expect(r.status).toBe(400);
  });

  it("rejects an oversized body (413)", async () => {
    const r = await callPost(
      "https://flathub.org/api/v2/search",
      JSON.stringify({ query: "x".repeat(10_000) }),
    );
    expect(r.status).toBe(413);
  });

  it("refuses to follow a redirect from the allowlisted host (502)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", { status: 302, headers: { location: "https://evil.example" } }),
      ),
    );
    const r = await callPost("https://flathub.org/api/v2/search", "{}");
    expect(r.status).toBe(502);
  });

  it("forces text/plain + attachment for a non-JSON upstream body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<script>alert(1)</script>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    const r = await callPost("https://flathub.org/api/v2/search", "{}");
    expect(r.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(r.headers.get("content-disposition")).toBe("attachment");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
