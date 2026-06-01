// Single entry point for every GitHub API call in the app.
//
// In production (Cloudflare Pages) this routes through the same-origin
// /api/gh function, which adds a server-side token + edge cache — lifting the
// flagship source off the unauthenticated 10 req/min (search) / 60 req/hr
// (core) shared limit. In plain `next dev` (no Pages Functions) /api/gh 404s,
// so we transparently fall back to a direct call to api.github.com — keeping
// local dev working without any setup. The token never reaches the client.

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";

const GH_DEFAULT_ACCEPT = "application/vnd.github.v3+json";

/**
 * Fetch a GitHub API URL via the authenticated proxy, falling back to a direct
 * call. Returns the Response (ok or not) or null on total network failure.
 * Callers decide how to read it (.json() / .text()).
 */
export async function ghFetch(
  githubUrl: string,
  accept: string = GH_DEFAULT_ACCEPT,
): Promise<Response | null> {
  if (BASE !== "disabled") {
    try {
      const proxied = `${BASE}/api/gh?url=${encodeURIComponent(
        githubUrl,
      )}&accept=${encodeURIComponent(accept)}`;
      const res = await fetch(proxied);
      // res.ok → authed proxy succeeded. Any non-ok (incl. 404 when the
      // function isn't running under `next dev`) falls through to direct.
      if (res.ok) return res;
    } catch {
      /* fall through to direct */
    }
  }
  try {
    return await fetch(githubUrl, { headers: { Accept: accept } });
  } catch {
    return null;
  }
}

/** Convenience: ghFetch + JSON parse, returning null on any failure. */
export async function ghJson<T = unknown>(githubUrl: string): Promise<T | null> {
  const res = await ghFetch(githubUrl);
  if (!res || !res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
