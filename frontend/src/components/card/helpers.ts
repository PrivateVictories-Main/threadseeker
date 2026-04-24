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
