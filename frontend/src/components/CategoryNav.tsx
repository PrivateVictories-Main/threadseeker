// Category definitions for the source-narrowing system. Originally
// (Iter-22 / Overhaul H) this module exported a `CategoryNav` component
// for a horizontal pill strip on the hero. As of Iter-23 / Major
// Overhaul I the visible navigation surface moved into the persistent
// AppSidebar + CategoryGrid. The data exports (CATEGORY_DEFS,
// CategoryKey, CategoryDef) are still consumed by page.tsx and the
// new CategoryGrid; they live here because every consumer expects
// "@/components/CategoryNav" — moving them to /lib would force a
// codebase-wide rename without functional benefit.
//
// Iter-24 / Major Overhaul J — pruned the unused CategoryNav component
// itself. The data exports below are the only public API.

import {
  Globe,
  GitBranch,
  Package,
  Cpu,
  FileText,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { SourceType } from "@/lib/sources/types";

export type CategoryKey = "all" | "repos" | "packages" | "ai" | "papers" | "threads";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  icon: LucideIcon;
  sources: SourceType[] | "all";
}

export const CATEGORY_DEFS: CategoryDef[] = [
  { key: "all", label: "All sources", icon: Globe, sources: "all" },
  {
    key: "repos",
    label: "Repositories",
    icon: GitBranch,
    sources: ["github", "gitlab", "codeberg"],
  },
  {
    key: "packages",
    label: "Packages",
    icon: Package,
    sources: [
      "npm",
      "pypi",
      "crates",
      "rubygems",
      "packagist",
      "nuget",
      "jsr",
      "conda",
      "homebrew",
      "dockerhub",
      "flathub",
      "fdroid",
      "aur",
      "openvsx",
      "wordpress",
      "maven",
      "hex",
    ],
  },
  { key: "ai", label: "AI Models", icon: Cpu, sources: ["huggingface", "paperswithcode"] },
  { key: "papers", label: "Papers", icon: FileText, sources: ["arxiv", "zenodo", "paperswithcode"] },
  {
    key: "threads",
    label: "Threads",
    icon: MessageSquare,
    sources: ["hackernews", "reddit", "lobsters", "stackoverflow", "devto"],
  },
];
