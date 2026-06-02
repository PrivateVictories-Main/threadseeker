import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Guard an href against javascript:/data:/vbscript: scheme injection. Upstream
// fields like a package homepage or a forum post URL are author-controlled, and
// React 18 still renders a `javascript:` href in production — so every dynamic
// href must pass through here. Returns the URL only for safe browsable schemes
// (http/https/mailto) or internal links (/ #); anything else collapses to "#".
export function safeHref(url: string | null | undefined): string {
  if (!url) return "#";
  const trimmed = url.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  try {
    const proto = new URL(trimmed, "https://threadseeker.pages.dev").protocol;
    return proto === "https:" || proto === "http:" || proto === "mailto:"
      ? trimmed
      : "#";
  } catch {
    return "#";
  }
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "k";
  return num.toString();
}

// Split a string into runs of matched vs non-matched text against the
// user's query terms. Case-insensitive, Unicode-safe, avoids regex injection
// by escaping each term. The result is a flat array suitable for rendering
// as <span>s. Empty `query` returns the input as a single non-match run.
export interface HighlightRun {
  text: string;
  match: boolean;
}

export function highlightQuery(
  text: string,
  query: string,
): HighlightRun[] {
  if (!text) return [{ text: "", match: false }];
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (terms.length === 0) return [{ text, match: false }];

  const pattern = new RegExp(
    `(${terms.map(escapeRegex).join("|")})`,
    "gi",
  );
  const parts = text.split(pattern);
  const runs: HighlightRun[] = [];
  for (const part of parts) {
    if (!part) continue;
    runs.push({ text: part, match: terms.includes(part.toLowerCase()) });
  }
  return runs;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function timeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  );

  const intervals: [string, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];

  for (const [label, secs] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count} ${label}${count !== 1 ? "s" : ""} ago`;
  }

  return "just now";
}
