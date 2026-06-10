import { describe, it, expect, vi, beforeEach } from "vitest";
import { onRequestPost } from "./rerank";

type Env = { GROQ_API_KEY?: string };

const ITEMS = [
  { id: "gh:facebook/react", name: "react", description: "UI library", source: "github" },
  { id: "npm:react", name: "react", description: "npm package", source: "npm" },
];

const call = (
  body: unknown,
  env: Env = {},
  headers: Record<string, string> = {},
) => {
  const req = new Request("https://ts.dev/api/rerank", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return (
    onRequestPost as unknown as (c: { request: Request; env: Env }) => Promise<Response>
  )({ request: req, env });
};

// A Groq chat-completions envelope whose assistant content is `content`.
const groqReply = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

let put: ReturnType<typeof vi.fn>;
beforeEach(() => {
  put = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("caches", {
    default: { match: vi.fn().mockResolvedValue(undefined), put },
  });
});

describe("/api/rerank keyless + origin + parse handling", () => {
  it("returns { disabled: true } (200) without a key and never calls Groq", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await call({ query: "react", items: ITEMS });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ disabled: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks a cross-origin request (403) before touching Groq", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await call(
      { query: "react", items: ITEMS },
      { GROQ_API_KEY: "fake-key" },
      { Origin: "https://evil.example" },
    );
    expect(r.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the parsed order from a valid Groq response, dropping invented ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      groqReply(
        JSON.stringify({ order: ["npm:react", "gh:invented/nope", "gh:facebook/react"] }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await call({ query: "react", items: ITEMS }, { GROQ_API_KEY: "fake-key" });
    expect(r.status).toBe(200);
    // Ids not in the submitted set must be filtered out, order preserved.
    expect(await r.json()).toEqual({ order: ["npm:react", "gh:facebook/react"] });
    // The Groq call carried the fake key.
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer fake-key");
    // A real success is edge-cached.
    expect(put).toHaveBeenCalledOnce();
  });

  it("degrades to { disabled: true } (200) on non-JSON Groq content — never a 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(groqReply("sorry, here's prose not JSON")));
    const r = await call({ query: "react", items: ITEMS }, { GROQ_API_KEY: "fake-key" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ disabled: true });
    // Degraded results must NOT be pinned into the edge cache.
    expect(put).not.toHaveBeenCalled();
  });

  it("degrades to { disabled: true } (200) when Groq itself 5xxs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("upstream sad", { status: 503 })));
    const r = await call({ query: "react", items: ITEMS }, { GROQ_API_KEY: "fake-key" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ disabled: true });
  });

  it("rejects an unparseable request body (400)", async () => {
    const r = await call("{not json", { GROQ_API_KEY: "fake-key" });
    expect(r.status).toBe(400);
  });

  it("returns { disabled: true } when no submitted item has a string id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await call(
      { query: "react", items: [{ id: 42, name: "bad" }] },
      { GROQ_API_KEY: "fake-key" },
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ disabled: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
