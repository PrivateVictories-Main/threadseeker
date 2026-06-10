// Per-source display config (name, icon, gradient colors) and the canonical
// "open the native search on this platform" URL. Kept together because a new
// source registration touches both — forgetting either is a common paper cut.

import {
  Github,
  Gitlab,
  Package,
  Package2,
  Boxes,
  Container,
  MessageCircle,
  BookOpen,
  GraduationCap,
  FileText,
  Coffee,
  FlaskConical,
  Sparkles,
  PenTool,
  Atom,
  Smile,
  Bug,
  Gem,
  TreePine,
  Hash,
  Layers,
  Hexagon,
  Gamepad2,
  Sigma,
  Puzzle,
  ScrollText,
  Cloud,
  Cog,
  Footprints,
  Candy,
  Braces,
  Parentheses,
  type LucideIcon,
} from "lucide-react";
import { SourceType } from "./types";

// Human category buckets used by SourceFilter to group the 29 sources into
// scannable sections. Ordering in `CATEGORY_ORDER` drives the sheet
// render order, so the "most useful" buckets come first.
export type SourceCategory =
  | "repos"
  | "packages"
  | "ai"
  | "community"
  | "scholarly";

export const CATEGORY_META: Record<
  SourceCategory,
  { title: string; order: number }
> = {
  repos:     { title: "Repos",     order: 0 },
  packages:  { title: "Packages",  order: 1 },
  ai:        { title: "AI & ML",   order: 2 },
  community: { title: "Community", order: 3 },
  scholarly: { title: "Scholarly", order: 4 },
};

interface SourceDisplayConfig {
  name: string;
  // Legacy emoji icon. Still rendered in places that haven't migrated to
  // the lucide variant yet (page.tsx pending-source ticker, Markdown export,
  // DirectJumps fallback). Long-term the lucide icon below will be the
  // single source of truth.
  icon: string;
  // Lucide React icon component for this source. Renders monochrome on
  // glass surfaces — reads as "system UI" rather than "cartoon emoji".
  // Some sources reuse the same icon (e.g. multiple package registries
  // → Package) since the registry name carries the disambiguation.
  lucideIcon: LucideIcon;
  color: string;
  borderColor: string;
  bgColor: string;
  supportsOr: boolean;
  category: SourceCategory;
  // True for sources that typically return cards without descriptions or
  // topics (community discussions, comment threads). The grid renders these
  // in the 260px sparse shell rather than the 340px tall shell. Used by
  // the loading-skeleton geometry picker so the grid doesn't visually pop
  // 340 → 260 on data-in for community-heavy searches.
  sparse?: boolean;
  // One-line plain-English description used as the filter-pill `title=`
  // tooltip + (future) screen-reader description. Some source names are
  // self-explanatory ("GitHub", "Reddit") but others are TLA-shaped
  // ("AUR", "JSR", "Open VSX") and benefit from the hover hint. Keep
  // each tagline ≤ 60 chars and verbless ("Arch User Repository", not
  // "Browse the Arch User Repository") so they stack consistently.
  tagline?: string;
}

const SOURCE_CONFIGS: Record<SourceType, SourceDisplayConfig> = {
  github: {
    name: "GitHub",
    icon: "🐙",
    lucideIcon: Github,
    color: "from-gray-500 to-gray-700",
    borderColor: "border-gray-500/30",
    bgColor: "bg-gray-500/10",
    supportsOr: true,
    category: "repos",
    tagline: "Code repositories on GitHub",
  },
  huggingface: {
    name: "Hugging Face",
    icon: "🤗",
    lucideIcon: Smile,
    color: "from-yellow-500 to-orange-500",
    borderColor: "border-yellow-500/30",
    bgColor: "bg-yellow-500/10",
    supportsOr: false,
    category: "ai",
    tagline: "AI models, datasets and spaces",
  },
  gitlab: {
    name: "GitLab",
    icon: "🦊",
    lucideIcon: Gitlab,
    color: "from-orange-500 to-red-500",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
    // GitLab's search treats OR/quotes as literal substrings (recall collapse).
    supportsOr: false,
    category: "repos",
    tagline: "Code repositories on GitLab.com",
  },
  npm: {
    name: "npm",
    icon: "📦",
    lucideIcon: Package,
    color: "from-red-600 to-red-700",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "JavaScript / TypeScript packages",
  },
  pypi: {
    name: "PyPI",
    icon: "🐍",
    // Package2 reads as a Python wheel/distribution shape (layered package)
    // — distinct from npm's plain Package and from crates' Boxes.
    lucideIcon: Package2,
    color: "from-blue-500 to-cyan-500",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Python packages",
  },
  crates: {
    name: "crates.io",
    icon: "🦀",
    // Boxes (multiple stacked boxes) reads as a Rust crate aggregate
    // — Cargo's mental model of dependencies as a stack of artifacts.
    lucideIcon: Boxes,
    color: "from-orange-600 to-amber-700",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Rust crates",
  },
  hackernews: {
    name: "Hacker News",
    icon: "💬",
    lucideIcon: MessageCircle,
    color: "from-orange-400 to-amber-500",
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/10",
    supportsOr: false,
    category: "community",
    sparse: true,
    tagline: "Tech-news threads from Hacker News",
  },
  codeberg: {
    name: "Codeberg",
    icon: "🌲",
    lucideIcon: TreePine,
    color: "from-emerald-500 to-teal-600",
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-500/10",
    // Codeberg (Gitea) search treats OR/quotes as literal substrings -> 0 hits.
    supportsOr: false,
    category: "repos",
    tagline: "Non-profit, community-run GitHub alternative",
  },
  packagist: {
    name: "Packagist",
    icon: "🐘",
    lucideIcon: Package,
    color: "from-indigo-500 to-purple-600",
    borderColor: "border-indigo-500/30",
    bgColor: "bg-indigo-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "PHP packages (Composer)",
  },
  rubygems: {
    name: "RubyGems",
    icon: "💎",
    lucideIcon: Gem,
    color: "from-red-500 to-pink-600",
    borderColor: "border-rose-500/30",
    bgColor: "bg-rose-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Ruby gems",
  },
  reddit: {
    name: "Reddit",
    icon: "👾",
    lucideIcon: MessageCircle,
    color: "from-orange-500 to-red-500",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
    supportsOr: false,
    category: "community",
    sparse: true,
    tagline: "Discussion threads from Reddit",
  },
  dockerhub: {
    name: "Docker Hub",
    icon: "🐳",
    lucideIcon: Container,
    color: "from-sky-500 to-blue-600",
    borderColor: "border-sky-500/30",
    bgColor: "bg-sky-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Container images",
  },
  jsr: {
    name: "JSR",
    icon: "🦕",
    lucideIcon: Package,
    color: "from-yellow-400 to-amber-500",
    borderColor: "border-yellow-500/30",
    bgColor: "bg-yellow-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "JS Registry — Deno-friendly TypeScript packages",
  },
  flathub: {
    name: "Flathub",
    icon: "📦",
    lucideIcon: Package,
    color: "from-sky-600 to-indigo-600",
    borderColor: "border-indigo-500/30",
    bgColor: "bg-indigo-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Linux desktop apps (Flatpak)",
  },
  devto: {
    name: "Dev.to",
    icon: "✍️",
    lucideIcon: PenTool,
    color: "from-zinc-400 to-zinc-600",
    borderColor: "border-zinc-500/30",
    bgColor: "bg-zinc-500/10",
    supportsOr: false,
    category: "community",
    sparse: true,
    tagline: "Developer blog posts on Dev.to",
  },
  lobsters: {
    name: "Lobsters",
    icon: "🦞",
    lucideIcon: MessageCircle,
    color: "from-rose-400 to-red-500",
    borderColor: "border-rose-500/30",
    bgColor: "bg-rose-500/10",
    supportsOr: false,
    category: "community",
    sparse: true,
    tagline: "Computing-focused link aggregator",
  },
  stackoverflow: {
    name: "Stack Overflow",
    icon: "📚",
    lucideIcon: GraduationCap,
    color: "from-orange-400 to-amber-500",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
    supportsOr: false,
    category: "community",
    sparse: true,
    tagline: "Q&A from Stack Overflow",
  },
  homebrew: {
    name: "Homebrew",
    icon: "🍺",
    lucideIcon: Coffee,
    color: "from-amber-500 to-yellow-600",
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "macOS / Linux package manager formulas",
  },
  fdroid: {
    name: "F-Droid",
    icon: "🤖",
    lucideIcon: Bug,
    color: "from-lime-500 to-green-600",
    borderColor: "border-lime-500/30",
    bgColor: "bg-lime-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Free / open-source Android apps",
  },
  arxiv: {
    name: "arXiv",
    icon: "📜",
    lucideIcon: BookOpen,
    color: "from-red-500 to-rose-600",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/10",
    supportsOr: false,
    category: "scholarly",
    tagline: "Open-access scholarly preprints",
  },
  aur: {
    name: "AUR",
    icon: "🏛️",
    lucideIcon: Layers,
    color: "from-sky-500 to-blue-600",
    borderColor: "border-sky-500/30",
    bgColor: "bg-sky-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Arch User Repository — community Arch packages",
  },
  openvsx: {
    name: "Open VSX",
    icon: "🧩",
    lucideIcon: Sparkles,
    color: "from-violet-500 to-purple-600",
    borderColor: "border-violet-500/30",
    bgColor: "bg-violet-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "VS Code extensions (vendor-neutral marketplace)",
  },
  conda: {
    name: "conda-forge",
    icon: "🥬",
    lucideIcon: Atom,
    color: "from-green-500 to-emerald-600",
    borderColor: "border-green-500/30",
    bgColor: "bg-green-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Scientific Python / R packages via Conda",
  },
  zenodo: {
    name: "Zenodo",
    icon: "🧪",
    lucideIcon: FlaskConical,
    color: "from-cyan-500 to-teal-600",
    borderColor: "border-cyan-500/30",
    bgColor: "bg-cyan-500/10",
    supportsOr: false,
    category: "scholarly",
    tagline: "Research datasets and software (CERN)",
  },
  nuget: {
    name: "NuGet",
    icon: "🔷",
    lucideIcon: Hash,
    color: "from-blue-600 to-indigo-700",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/10",
    supportsOr: false,
    category: "packages",
    tagline: ".NET packages",
  },
  wordpress: {
    name: "WordPress",
    icon: "📝",
    lucideIcon: FileText,
    color: "from-slate-500 to-slate-700",
    borderColor: "border-slate-500/30",
    bgColor: "bg-slate-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "WordPress plugins",
  },
  maven: {
    name: "Maven Central",
    icon: "☕",
    lucideIcon: Coffee,
    color: "from-amber-600 to-orange-700",
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Java / JVM artifacts",
  },
  hex: {
    name: "Hex",
    icon: "⬣",
    lucideIcon: Hexagon,
    color: "from-purple-600 to-fuchsia-700",
    borderColor: "border-purple-500/30",
    bgColor: "bg-purple-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Elixir / Erlang packages",
  },
  pub: {
    name: "pub.dev",
    icon: "🎯",
    lucideIcon: Package,
    color: "from-sky-500 to-blue-600",
    borderColor: "border-sky-500/30",
    bgColor: "bg-sky-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Dart / Flutter packages",
  },
  modrinth: {
    name: "Modrinth",
    icon: "⛏️",
    lucideIcon: Gamepad2,
    color: "from-green-500 to-emerald-600",
    borderColor: "border-green-500/30",
    bgColor: "bg-green-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Minecraft mods, plugins and packs",
  },
  cran: {
    name: "CRAN",
    icon: "📊",
    lucideIcon: Sigma,
    color: "from-blue-500 to-indigo-600",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "R packages",
  },
  amo: {
    name: "Firefox Add-ons",
    icon: "🧩",
    lucideIcon: Puzzle,
    color: "from-orange-500 to-amber-600",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Firefox browser extensions (AMO)",
  },
  greasyfork: {
    name: "Greasy Fork",
    icon: "🐒",
    lucideIcon: ScrollText,
    color: "from-red-600 to-rose-700",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Userscripts (Greasemonkey / Tampermonkey)",
  },
  terraform: {
    name: "Terraform Registry",
    icon: "🏗️",
    lucideIcon: Cloud,
    color: "from-purple-500 to-violet-600",
    borderColor: "border-purple-500/30",
    bgColor: "bg-purple-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Terraform / OpenTofu infrastructure modules",
  },
  snap: {
    name: "Snapcraft",
    icon: "🧰",
    lucideIcon: Package,
    color: "from-orange-600 to-amber-700",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Linux apps (snap packages)",
  },
  ansible: {
    name: "Ansible Galaxy",
    icon: "⚙️",
    lucideIcon: Cog,
    color: "from-red-600 to-red-700",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Ansible automation collections",
  },
  gnome: {
    name: "GNOME Extensions",
    // The GNOME logo is a foot — Footprints is the closest lucide glyph.
    icon: "🦶",
    lucideIcon: Footprints,
    color: "from-sky-500 to-blue-600",
    borderColor: "border-sky-500/30",
    bgColor: "bg-sky-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "GNOME Shell extensions",
  },
  chocolatey: {
    name: "Chocolatey",
    icon: "🍫",
    lucideIcon: Candy,
    color: "from-sky-400 to-blue-600",
    borderColor: "border-sky-500/30",
    bgColor: "bg-sky-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Windows packages",
  },
  vcpkg: {
    name: "vcpkg",
    icon: "🧱",
    // Braces read as C/C++ source — the ecosystem vcpkg packages.
    lucideIcon: Braces,
    color: "from-blue-600 to-indigo-700",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "C / C++ libraries (Microsoft vcpkg)",
  },
  melpa: {
    name: "MELPA",
    icon: "🪐",
    // Emacs packages are Lisp — Parentheses is the honest glyph.
    lucideIcon: Parentheses,
    color: "from-violet-500 to-purple-700",
    borderColor: "border-violet-500/30",
    bgColor: "bg-violet-500/10",
    supportsOr: false,
    category: "packages",
    tagline: "Emacs Lisp packages",
  },
};

// The canonical, exhaustive list of every source — derived from the config
// Record (which the SourceType-keyed type forces to be complete) so adding a
// source in ONE place can't drift from a hand-maintained array elsewhere.
// Order = registry declaration order (high-signal repo/package hosts first),
// which is also the streaming priority for the default search.
export const ALL_SOURCE_TYPES = Object.keys(SOURCE_CONFIGS) as SourceType[];

export function getSourceConfig(source: SourceType): SourceDisplayConfig {
  return SOURCE_CONFIGS[source];
}

// Returns the lucide React icon component for a source. Render as e.g.
// `<Icon className="w-3.5 h-3.5" />` — the caller controls size + color
// so the icon inherits the surrounding text color (currentColor).
export function getSourceIcon(source: SourceType): LucideIcon {
  return SOURCE_CONFIGS[source].lucideIcon;
}

// Returns true when a source typically yields cards without descriptions
// or topics — the ones that fit the 260px sparse-card geometry rather
// than the 340px tall geometry. Used for skeleton-shape selection.
export function isSparseSource(source: SourceType): boolean {
  return SOURCE_CONFIGS[source]?.sparse === true;
}

// Fraction of the given source list that's marked sparse, in [0..1].
// Used by the loading-skeleton picker to choose tall vs sparse geometry
// when the user's selection is mixed (e.g. github + reddit + lobsters).
// >= 0.6 → render the shorter sparse skeletons so the grid doesn't pop
// from 340 → 260 on data-in.
export function sparseFraction(sources: SourceType[]): number {
  if (sources.length === 0) return 0;
  let n = 0;
  for (const s of sources) if (isSparseSource(s)) n++;
  return n / sources.length;
}

// Group a list of sources by their declared category, preserving the
// CATEGORY_META ordering. Empty categories are dropped. Callers get a
// ready-to-render list of { title, sources[] } pairs.
export function groupSourcesByCategory(
  sources: SourceType[],
): Array<{ category: SourceCategory; title: string; sources: SourceType[] }> {
  const buckets = new Map<SourceCategory, SourceType[]>();
  for (const s of sources) {
    const cfg = SOURCE_CONFIGS[s];
    if (!cfg) continue;
    const list = buckets.get(cfg.category) ?? [];
    list.push(s);
    buckets.set(cfg.category, list);
  }
  return [...buckets.entries()]
    .map(([category, list]) => ({
      category,
      title: CATEGORY_META[category].title,
      sources: list,
    }))
    .sort(
      (a, b) => CATEGORY_META[a.category].order - CATEGORY_META[b.category].order,
    );
}

// Native search URL on the upstream platform, used by the "see all on X"
// escape hatch when ThreadSeeker's top-ranked slice isn't enough.
export function getSourceSearchUrl(source: SourceType, query: string): string | null {
  const q = encodeURIComponent(query);
  switch (source) {
    case "github":
      return `https://github.com/search?q=${q}&type=repositories`;
    case "gitlab":
      return `https://gitlab.com/search?search=${q}`;
    case "codeberg":
      return `https://codeberg.org/explore/repos?q=${q}`;
    case "npm":
      return `https://www.npmjs.com/search?q=${q}`;
    case "pypi":
      return `https://pypi.org/search/?q=${q}`;
    case "crates":
      return `https://crates.io/search?q=${q}`;
    case "packagist":
      return `https://packagist.org/?query=${q}`;
    case "rubygems":
      return `https://rubygems.org/search?query=${q}`;
    case "jsr":
      return `https://jsr.io/packages?search=${q}`;
    case "huggingface":
      return `https://huggingface.co/search/full-text?q=${q}`;
    case "hackernews":
      return `https://hn.algolia.com/?q=${q}`;
    case "reddit":
      return `https://www.reddit.com/search/?q=${q}`;
    case "lobsters":
      return `https://lobste.rs/search?q=${q}&what=stories&order=relevance`;
    case "stackoverflow":
      return `https://stackoverflow.com/search?q=${q}`;
    case "devto":
      return `https://dev.to/search?q=${q}`;
    case "dockerhub":
      return `https://hub.docker.com/search?q=${q}`;
    case "flathub":
      return `https://flathub.org/apps/search?q=${q}`;
    case "homebrew":
      return `https://formulae.brew.sh/formula-search/?q=${q}`;
    case "fdroid":
      return `https://search.f-droid.org/?q=${q}`;
    case "aur":
      return `https://aur.archlinux.org/packages?K=${q}`;
    case "openvsx":
      return `https://open-vsx.org/?query=${q}`;
    case "conda":
      return `https://anaconda.org/search?q=${q}`;
    case "arxiv":
      return `https://arxiv.org/search/?query=${q}&searchtype=all`;
    case "zenodo":
      return `https://zenodo.org/search?q=${q}`;
    case "nuget":
      return `https://www.nuget.org/packages?q=${q}`;
    case "wordpress":
      return `https://wordpress.org/plugins/search/${q}/`;
    case "maven":
      return `https://central.sonatype.com/search?q=${q}`;
    case "hex":
      return `https://hex.pm/packages?search=${q}`;
    case "pub":
      return `https://pub.dev/packages?q=${q}`;
    case "modrinth":
      return `https://modrinth.com/discover/mods?q=${q}`;
    case "cran":
      return `https://www.r-pkg.org/search.html?q=${q}`;
    case "amo":
      return `https://addons.mozilla.org/en-US/firefox/search/?q=${q}`;
    case "greasyfork":
      return `https://greasyfork.org/en/scripts?q=${q}`;
    case "terraform":
      return `https://registry.terraform.io/search/modules?q=${q}`;
    case "snap":
      return `https://snapcraft.io/search?q=${q}`;
    case "ansible":
      return `https://galaxy.ansible.com/ui/search/?keywords=${q}`;
    case "gnome":
      return `https://extensions.gnome.org/#q=${q}`;
    case "chocolatey":
      return `https://community.chocolatey.org/packages?q=${q}`;
    case "vcpkg":
      return `https://vcpkg.io/en/packages?query=${q}`;
    case "melpa":
      return `https://melpa.org/#/?q=${q}`;
    default:
      return null;
  }
}
