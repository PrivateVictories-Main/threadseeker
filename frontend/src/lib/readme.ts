// README fetcher for repo-style projects. Returns a lightly-stripped plain
// text excerpt so we can render a preview without pulling in a markdown
// renderer or risking XSS from rendered HTML.

import type { SourceType } from "./sources";
import { ghFetch } from "./github";

const CACHE = new Map<string, string>();

export function supportsReadme(source: SourceType): boolean {
  return source === "github" || source === "codeberg" || source === "gitlab";
}

export async function fetchReadmeExcerpt(
  source: SourceType,
  fullName: string,
): Promise<string | null> {
  const key = `${source}:${fullName}`;
  if (CACHE.has(key)) return CACHE.get(key)!;

  let raw: string | null = null;
  try {
    if (source === "github") {
      // Via /api/gh (token + edge cache) with the raw media type; falls back
      // to a direct call in plain dev. README fetches on card-expand used to
      // burn the same unauthenticated budget as search.
      const res = await ghFetch(
        `https://api.github.com/repos/${encodeURI(fullName)}/readme`,
        "application/vnd.github.v3.raw",
      );
      if (res && res.ok) raw = await res.text();
    } else if (source === "codeberg") {
      // Codeberg (Gitea) — /repos/{owner}/{repo}/readme returns JSON with
      // base64 content by default.
      const res = await fetch(
        `https://codeberg.org/api/v1/repos/${encodeURI(fullName)}/readme`,
        { headers: { Accept: "application/json" } },
      );
      if (res.ok) {
        const data = await res.json();
        if (typeof data.content === "string") {
          try {
            raw = atob(data.content.replace(/\s/g, ""));
          } catch {
            raw = null;
          }
        }
      }
    } else if (source === "gitlab") {
      // GitLab needs a project ID, not owner/repo — the list endpoint resolves
      // it. Skipped for now to keep this function cheap; returns null.
      raw = null;
    }
  } catch {
    raw = null;
  }

  if (!raw) {
    CACHE.set(key, "");
    return null;
  }

  const excerpt = stripMarkdown(raw).slice(0, 1200);
  CACHE.set(key, excerpt);
  return excerpt;
}

function stripMarkdown(md: string): string {
  return md
    // code fences
    .replace(/```[\s\S]*?```/g, "")
    // inline code
    .replace(/`([^`]+)`/g, "$1")
    // images
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // links — keep text, drop url
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // headings
    .replace(/^#+\s+/gm, "")
    // bold/italic markers
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    // html tags
    .replace(/<[^>]+>/g, "")
    // horizontal rules
    .replace(/^[-=]{3,}$/gm, "")
    // collapse whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
