import { describe, it, expect, vi, afterEach } from "vitest";
import { ghFetch } from "./github";

const res = (status: number, body = "{}") => new Response(body, { status });

afterEach(() => vi.restoreAllMocks());

describe("ghFetch — proxy/direct fallback contract", () => {
  it("uses the /api/gh proxy and returns it on success (no direct call)", async () => {
    const fetchMock = vi.fn(async (_url?: unknown) => res(200, '{"ok":1}'));
    vi.stubGlobal("fetch", fetchMock);
    const r = await ghFetch("https://api.github.com/x");
    expect(r?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/gh?url=");
  });

  it("falls back to a direct call when the proxy is ABSENT (404 in dev)", async () => {
    const fetchMock = vi.fn(async (url: string | URL) =>
      String(url).includes("/api/gh") ? res(404) : res(200, '{"direct":1}'),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await ghFetch("https://api.github.com/x");
    expect(r?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://api.github.com/x");
  });

  it("does NOT fall back to unauthenticated on a relayed 403 (rate limit)", async () => {
    const fetchMock = vi.fn(async () => res(403));
    vi.stubGlobal("fetch", fetchMock);
    const r = await ghFetch("https://api.github.com/x");
    expect(r?.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second unauth call
  });

  it("falls back to direct on a proxy network error", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url).includes("/api/gh")) throw new Error("network");
      return res(200, '{"direct":1}');
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await ghFetch("https://api.github.com/x");
    expect(r?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
