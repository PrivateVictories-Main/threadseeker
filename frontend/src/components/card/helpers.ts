// Formatting + classification helpers for UnifiedProjectCard. Kept separate
// so the card component stays presentational and these pure functions can be
// unit-tested (and reused) without pulling React in.

import type { UnifiedProject } from "@/lib/sources/types";
import type { MaintenanceState } from "./CardPills";
import type { CopyItem } from "./CardActions";

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function licenseBucket(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  const l = raw.toLowerCase();
  if (/mit|apache|bsd|isc|unlicense|cc-by/.test(l)) return raw;
  if (/lgpl|mpl/.test(l)) return raw;
  if (/gpl|agpl|copyleft/.test(l)) return raw;
  return raw;
}

export function maintenanceState(updatedAt: string): MaintenanceState {
  if (!updatedAt) return "unknown";
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return "unknown";
  const days = (Date.now() - t) / 86_400_000;
  if (days < 90) return "active";
  if (days < 365) return "recent";
  if (days < 365 * 3) return "stale";
  return "abandoned";
}

// Human-friendly relative-time formatter. Pure JS, no deps. Uses the
// same long-form unit vocabulary ("3 minutes ago", "2 hours ago")
// across all buckets so nothing abbreviates half the scale and spells
// out the other half. "just now" sits inside the 45-second edge.
export function formatRelativeTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.max(0, (Date.now() - t) / 1000);
  if (diffSec < 45) return "just now";
  const diffMin = diffSec / 60;
  if (diffMin < 60) {
    const n = Math.round(diffMin);
    return `${n} ${n === 1 ? "minute" : "minutes"} ago`;
  }
  const diffHr = diffMin / 60;
  if (diffHr < 24) {
    const n = Math.round(diffHr);
    return `${n} ${n === 1 ? "hour" : "hours"} ago`;
  }
  const diffDay = diffHr / 24;
  if (diffDay < 7) {
    const n = Math.round(diffDay);
    return `${n} ${n === 1 ? "day" : "days"} ago`;
  }
  if (diffDay < 30) {
    const n = Math.round(diffDay / 7);
    return `${n} ${n === 1 ? "week" : "weeks"} ago`;
  }
  if (diffDay < 365) {
    const n = Math.round(diffDay / 30);
    return `${n} ${n === 1 ? "month" : "months"} ago`;
  }
  const n = Math.round(diffDay / 365);
  return `${n} ${n === 1 ? "year" : "years"} ago`;
}

// Stable hue for avatar fallback gradients. Hashes the project id to one
// of 8 indigo/violet/sky-adjacent hues so a row of avatarless cards has
// subtle visual variation instead of nine identical accent circles —
// without leaving the indigo-only design north star.
//
// The hue palette intentionally stays inside {210..280} so every choice
// reads as "still indigo/violet family", just slightly cooler or warmer.
const FALLBACK_HUES = [210, 220, 230, 240, 250, 260, 270, 280] as const;

export function avatarFallbackHue(id: string): number {
  // Tiny FNV-1a-ish hash — deterministic, no deps. Same id → same hue.
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Map the hash into the palette index. >>> 0 to get an unsigned int.
  return FALLBACK_HUES[(h >>> 0) % FALLBACK_HUES.length];
}

// Source-aware primary-action label. Tightens the click affordance to
// name what the user is about to visit — "View paper", "Get app",
// "Install extension" — instead of the all-purpose "Open". Each label
// is short enough to fit the existing button width vocabulary (the
// trailing "→" lives in CardActions, so each return here is the verb +
// noun only). Sources outside this map fall back to "Open".
//
// Stack Overflow renders as "View answer" (top result is the question
// page, where the accepted answer is the headline content) rather than
// the more generic "Open thread" — same destination, sharper read.
export function openLabelForSource(source: UnifiedProject["source"]): string {
  switch (source) {
    case "reddit":
    case "hackernews":
    case "lobsters":
      return "Open thread";
    case "stackoverflow":
      return "View answer";
    case "arxiv":
    case "paperswithcode":
    case "zenodo":
      return "View paper";
    case "devto":
      return "Read post";
    case "flathub":
    case "fdroid":
      return "Get app";
    case "openvsx":
      return "Install extension";
    case "wordpress":
      return "View plugin";
    case "dockerhub":
      return "Pull image";
    case "aur":
      // "View package" rather than "Install via AUR" — the latter is too
      // prescriptive (assumes Arch + that the user wants to clone the
      // PKGBUILD) for what's actually just a deep-link to the AUR page.
      return "View package";
    case "nuget":
      return "View package";
    default:
      return "Open";
  }
}

// Source-aware popularity glyph + count. Repos and packages keep the
// star/download glyph; threads (HN/Reddit/Lobsters) swap to a triangle
// upvote glyph (more semantically accurate than ★ for an upvote count)
// and append a comments-count via the speech-bubble glyph when present.
// Returns null when the project carries no popularity signal at all
// (empty pills suppress entirely via CardPills.tsx).
export function popularityForProject(p: UnifiedProject): string | null {
  const isThread =
    p.source === "reddit" ||
    p.source === "hackernews" ||
    p.source === "lobsters";
  if (isThread) {
    const parts: string[] = [];
    if (p.stars > 0) parts.push(`▲ ${formatCount(p.stars)}`);
    if (p.commentsCount && p.commentsCount > 0) {
      parts.push(`💬 ${formatCount(p.commentsCount)}`);
    }
    return parts.length ? parts.join(" · ") : null;
  }
  if (p.stars > 0) return `★ ${formatCount(p.stars)}`;
  if (p.downloads) return `↓ ${formatCount(p.downloads)}`;
  return null;
}

// Iter-15 — "why is this popular" classification.
// Returns one of a small label set the card surfaces as a top-right badge:
//   - "new"         — repo born in the last 60 days
//   - "hot"         — high stars (>=1000) AND brand-new (age < 30d)
//   - "trending"    — high stars (>5000) AND age < 6 months
//   - "rising"      — moderate stars (1k–5k) AND age < 1 year
//   - "established" — long-running and beloved (>10k stars, age > 3y)
//   - null          — none of the above; render no badge
//
// Rule order matters: "hot" supersedes "trending" supersedes "rising"
// because a brand-new repo with 1k+ stars and <30d age really is qualitatively
// different from a six-month-old one with 5k stars (the rate of growth is
// the signal). "new" without a star floor is reserved for genuinely fresh
// projects so the badge means something at the long tail of obscure repos
// — otherwise every brand-new fork would carry it.
export type PopularityClass =
  | "new"
  | "hot"
  | "trending"
  | "rising"
  | "established"
  | null;

export function popularityClass(p: UnifiedProject): PopularityClass {
  const created = p.createdAt;
  if (!created) return null;
  const t = new Date(created).getTime();
  if (Number.isNaN(t)) return null;
  const ageDays = (Date.now() - t) / 86_400_000;
  const stars = p.stars || 0;

  // "hot" is the loudest — must be both very fresh AND already starred.
  if (stars >= 1000 && ageDays < 30) return "hot";
  // "trending" — high stars in a short window. Threshold at >5k so the
  // badge stays meaningful (a 5k-star repo in 6 months is genuinely
  // gaining traction, not just background growth).
  if (stars > 5000 && ageDays < 180) return "trending";
  // "rising" — middle band. 1k-5k stars, < 1 year. Catches the upward
  // trajectory that "trending" misses.
  if (stars >= 1000 && stars <= 5000 && ageDays < 365) return "rising";
  // "established" — proves longevity. >10k stars + > 3y age. Skipped
  // when the repo is also "trending" because trending already won.
  if (stars > 10_000 && ageDays > 365 * 3) return "established";
  // "new" — brand-new repos at any star floor. Useful at the long tail
  // (no stars, just hot off the press). Sits last so the higher-signal
  // bands win when they apply.
  if (ageDays < 60) return "new";
  return null;
}

// Human-friendly label for a popularity class. Kept separate so the card
// can also show a tooltip explaining *why* — e.g. "Hot — 1.2k stars in
// under a month". Returns "" when class is null (caller guards).
export function popularityClassLabel(cls: PopularityClass): string {
  switch (cls) {
    case "hot":
      return "Hot";
    case "trending":
      return "Trending";
    case "rising":
      return "Rising";
    case "established":
      return "Established";
    case "new":
      return "New";
    default:
      return "";
  }
}

// Per-source metric-grid descriptor. Drives the new 3-column metric cells
// at the bottom of the card. Each entry returns up to 3 cells; the card
// renders only the cells it has values for (keeps sparse adapters from
// showing a row of "—"). The returned shape is a tuple of label + value
// + optional title for the native tooltip.
export interface MetricCell {
  label: string;
  value: string;
  title?: string;
}

export function formatRelativeShort(iso: string): string {
  // Short form for the metric grid — tighter than formatRelativeTime so
  // a "LAST PUBLISH" cell reads as "3d" / "5w" / "2y" rather than the
  // long-form "3 days ago". Used inside compact pills.
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffDay = Math.max(0, (Date.now() - t) / 86_400_000);
  if (diffDay < 1) return "today";
  if (diffDay < 7) return `${Math.round(diffDay)}d`;
  if (diffDay < 30) return `${Math.round(diffDay / 7)}w`;
  if (diffDay < 365) return `${Math.round(diffDay / 30)}mo`;
  return `${Math.round(diffDay / 365)}y`;
}

export function metricsForProject(p: UnifiedProject): MetricCell[] {
  const cells: MetricCell[] = [];
  const push = (label: string, value: string | number | undefined, title?: string) => {
    if (value === undefined || value === null) return;
    if (typeof value === "string" && !value) return;
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) return;
    cells.push({
      label,
      value: typeof value === "number" ? formatCount(value) : value,
      title,
    });
  };

  switch (p.source) {
    case "github":
    case "gitlab":
    case "codeberg":
      push("Stars", p.stars);
      push("Forks", p.forks);
      push("Issues", p.openIssues);
      break;
    case "huggingface":
      push("Downloads", p.downloads);
      push("Likes", p.upvotes ?? p.stars);
      push("Format", p.language || undefined);
      break;
    case "npm":
    case "pypi":
    case "crates":
    case "rubygems":
    case "packagist":
    case "jsr":
    case "nuget":
    case "conda":
    case "maven":
      push("Downloads", p.weeklyDownloads ?? p.downloads);
      push("Version", p.version || undefined);
      push(
        "Published",
        p.lastPublished ? formatRelativeShort(p.lastPublished) : undefined,
        p.lastPublished,
      );
      break;
    case "homebrew":
    case "dockerhub":
      push("Downloads", p.downloads);
      push("Version", p.version || undefined);
      push("Stars", p.stars);
      break;
    case "arxiv":
    case "paperswithcode":
    case "zenodo":
      if (p.citations !== undefined) push("Citations", p.citations);
      else push("Downloads", p.downloads);
      push("Year", p.paperYear !== undefined ? String(p.paperYear) : undefined);
      push(
        "Authors",
        p.paperAuthors && p.paperAuthors.length
          ? String(p.paperAuthors.length)
          : undefined,
        p.paperAuthors?.slice(0, 3).join(", "),
      );
      break;
    case "hackernews":
    case "reddit":
    case "lobsters":
    case "stackoverflow":
    case "devto":
      push("Upvotes", p.upvotes ?? p.stars);
      push("Comments", p.comments ?? p.commentsCount);
      push(
        "Posted",
        p.createdAt ? formatRelativeShort(p.createdAt) : undefined,
        p.createdAt,
      );
      break;
    case "flathub":
    case "fdroid":
      push("Installs", p.downloads);
      push("Version", p.version || undefined);
      push("Stars", p.stars);
      break;
    case "openvsx":
    case "wordpress":
      push("Downloads", p.downloads);
      push("Version", p.version || undefined);
      push("Stars", p.stars);
      break;
    case "aur":
      push("Votes", p.stars);
      push("Version", p.version || undefined);
      push(
        "Updated",
        p.updatedAt ? formatRelativeShort(p.updatedAt) : undefined,
        p.updatedAt,
      );
      break;
  }
  return cells.slice(0, 3);
}

export function copyItemsForSource(p: UnifiedProject): CopyItem[] {
  switch (p.source) {
    case "github":
    case "gitlab":
    case "codeberg":
      return [{ label: "Clone", text: `git clone ${p.url}.git` }];
    case "npm":
      return [{ label: "npm i", text: `npm install ${p.name}` }];
    case "pypi":
      return [{ label: "pip install", text: `pip install ${p.name}` }];
    case "crates":
      return [{ label: "cargo add", text: `cargo add ${p.name}` }];
    case "rubygems":
      return [{ label: "gem install", text: `gem install ${p.name}` }];
    case "packagist":
      return [{ label: "composer", text: `composer require ${p.fullName}` }];
    case "nuget":
      return [{ label: "dotnet add", text: `dotnet add package ${p.name}` }];
    case "homebrew":
      return [{ label: "brew install", text: `brew install ${p.name}` }];
    case "conda":
      return [{ label: "conda install", text: `conda install -c conda-forge ${p.name}` }];
    case "huggingface":
      return [{ label: "Install", text: `pip install transformers && # load ${p.name}` }];
    case "arxiv":
      return [{ label: "Cite", text: p.url }];
    default:
      return [];
  }
}
