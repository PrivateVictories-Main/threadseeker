import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeQuery, crossOriginBlocked, cachedJson } from "./http";

describe("sanitizeQuery", () => {
  it("rejects non-strings and blank input", () => {
    expect(sanitizeQuery(null)).toBeNull();
    expect(sanitizeQuery(123)).toBeNull();
    expect(sanitizeQuery({})).toBeNull();
    expect(sanitizeQuery("")).toBeNull();
    expect(sanitizeQuery("   ")).toBeNull();
  });

  it("strips control chars + DEL and trims", () => {
    const input = `  he${String.fromCharCode(0)}llo${String.fromCharCode(127)}  `;
    expect(sanitizeQuery(input)).toBe("hello");
  });

  it("clamps over-long input to null, keeps max-length", () => {
    expect(sanitizeQuery("a".repeat(1001))).toBeNull();
    expect(sanitizeQuery("a".repeat(1000))).toBe("a".repeat(1000));
  });
});

describe("crossOriginBlocked", () => {
  const mk = (origin?: string) =>
    new Request("https://threadseeker.pages.dev/api/x", {
      headers: origin ? { Origin: origin } : {},
    });

  it("allows a same-origin request", () => {
    expect(crossOriginBlocked(mk("https://threadseeker.pages.dev"))).toBeNull();
  });

  it("allows an Origin-less request (curl / server-side)", () => {
    expect(crossOriginBlocked(mk())).toBeNull();
  });

  it("allows localhost dev", () => {
    expect(crossOriginBlocked(mk("http://localhost:3000"))).toBeNull();
  });

  it("blocks a foreign Origin with 403", () => {
    const r = crossOriginBlocked(mk("https://evil.example"));
    expect(r).not.toBeNull();
    expect(r!.status).toBe(403);
  });
});

describe("cachedJson", () => {
  let put: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    put = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("caches", {
      default: { match: vi.fn().mockResolvedValue(undefined), put },
    });
  });

  it("does NOT cache a degraded { disabled: true } result", async () => {
    const req = new Request("https://x.dev/api/synth", { method: "POST" });
    const resp = await cachedJson(req, ["k"], 60, async () => ({ disabled: true }));
    expect(await resp.json()).toEqual({ disabled: true });
    expect(put).not.toHaveBeenCalled();
  });

  it("caches a real success exactly once", async () => {
    const req = new Request("https://x.dev/api/synth", { method: "POST" });
    await cachedJson(req, ["k"], 60, async () => ({ verdict: "ok" }));
    expect(put).toHaveBeenCalledOnce();
  });
});
