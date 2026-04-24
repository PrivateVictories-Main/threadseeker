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
  const days = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
  if (days < 90) return "active";
  if (days < 365) return "recent";
  if (days < 365 * 3) return "stale";
  return "abandoned";
}

// Short human-friendly relative-time formatter. Pure JS, no deps.
// Examples: "just now", "3m ago", "2h ago", "5 days ago", "3 weeks ago",
// "2 months ago", "4 years ago".
export function formatRelativeTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.max(0, (Date.now() - t) / 1000);
  if (diffSec < 45) return "just now";
  const diffMin = diffSec / 60;
  if (diffMin < 60) return `${Math.round(diffMin)}m ago`;
  const diffHr = diffMin / 60;
  if (diffHr < 24) return `${Math.round(diffHr)}h ago`;
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
