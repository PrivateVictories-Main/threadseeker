// Per-source display config (name, icon, gradient colors) and the canonical
// "open the native search on this platform" URL. Kept together because a new
// source registration touches both — forgetting either is a common paper cut.

import { SourceType } from "./types";

interface SourceDisplayConfig {
  name: string;
  icon: string;
  color: string;
  borderColor: string;
  bgColor: string;
}

const SOURCE_CONFIGS: Record<SourceType, SourceDisplayConfig> = {
  github: {
    name: "GitHub",
    icon: "🐙",
    color: "from-gray-500 to-gray-700",
    borderColor: "border-gray-500/30",
    bgColor: "bg-gray-500/10",
  },
  huggingface: {
    name: "Hugging Face",
    icon: "🤗",
    color: "from-yellow-500 to-orange-500",
    borderColor: "border-yellow-500/30",
    bgColor: "bg-yellow-500/10",
  },
  gitlab: {
    name: "GitLab",
    icon: "🦊",
    color: "from-orange-500 to-red-500",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
  },
  npm: {
    name: "npm",
    icon: "📦",
    color: "from-red-600 to-red-700",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/10",
  },
  pypi: {
    name: "PyPI",
    icon: "🐍",
    color: "from-blue-500 to-cyan-500",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/10",
  },
  crates: {
    name: "crates.io",
    icon: "🦀",
    color: "from-orange-600 to-amber-700",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
  },
  hackernews: {
    name: "Hacker News",
    icon: "💬",
    color: "from-orange-400 to-amber-500",
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/10",
  },
  codeberg: {
    name: "Codeberg",
    icon: "🌲",
    color: "from-emerald-500 to-teal-600",
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-500/10",
  },
  packagist: {
    name: "Packagist",
    icon: "🐘",
    color: "from-indigo-500 to-purple-600",
    borderColor: "border-indigo-500/30",
    bgColor: "bg-indigo-500/10",
  },
  rubygems: {
    name: "RubyGems",
    icon: "💎",
    color: "from-red-500 to-pink-600",
    borderColor: "border-rose-500/30",
    bgColor: "bg-rose-500/10",
  },
  reddit: {
    name: "Reddit",
    icon: "👾",
    color: "from-orange-500 to-red-500",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
  },
  dockerhub: {
    name: "Docker Hub",
    icon: "🐳",
    color: "from-sky-500 to-blue-600",
    borderColor: "border-sky-500/30",
    bgColor: "bg-sky-500/10",
  },
  jsr: {
    name: "JSR",
    icon: "🦕",
    color: "from-yellow-400 to-amber-500",
    borderColor: "border-yellow-500/30",
    bgColor: "bg-yellow-500/10",
  },
  flathub: {
    name: "Flathub",
    icon: "📦",
    color: "from-sky-600 to-indigo-600",
    borderColor: "border-indigo-500/30",
    bgColor: "bg-indigo-500/10",
  },
  devto: {
    name: "Dev.to",
    icon: "✍️",
    color: "from-zinc-400 to-zinc-600",
    borderColor: "border-zinc-500/30",
    bgColor: "bg-zinc-500/10",
  },
  lobsters: {
    name: "Lobsters",
    icon: "🦞",
    color: "from-rose-400 to-red-500",
    borderColor: "border-rose-500/30",
    bgColor: "bg-rose-500/10",
  },
  stackoverflow: {
    name: "Stack Overflow",
    icon: "📚",
    color: "from-orange-400 to-amber-500",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
  },
  paperswithcode: {
    name: "Papers with Code",
    icon: "📄",
    color: "from-violet-500 to-fuchsia-500",
    borderColor: "border-violet-500/30",
    bgColor: "bg-violet-500/10",
  },
  homebrew: {
    name: "Homebrew",
    icon: "🍺",
    color: "from-amber-500 to-yellow-600",
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/10",
  },
  fdroid: {
    name: "F-Droid",
    icon: "🤖",
    color: "from-lime-500 to-green-600",
    borderColor: "border-lime-500/30",
    bgColor: "bg-lime-500/10",
  },
  arxiv: {
    name: "arXiv",
    icon: "📜",
    color: "from-red-500 to-rose-600",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/10",
  },
  aur: {
    name: "AUR",
    icon: "🏛️",
    color: "from-sky-500 to-blue-600",
    borderColor: "border-sky-500/30",
    bgColor: "bg-sky-500/10",
  },
  openvsx: {
    name: "Open VSX",
    icon: "🧩",
    color: "from-violet-500 to-purple-600",
    borderColor: "border-violet-500/30",
    bgColor: "bg-violet-500/10",
  },
  conda: {
    name: "conda-forge",
    icon: "🥬",
    color: "from-green-500 to-emerald-600",
    borderColor: "border-green-500/30",
    bgColor: "bg-green-500/10",
  },
  zenodo: {
    name: "Zenodo",
    icon: "🧪",
    color: "from-cyan-500 to-teal-600",
    borderColor: "border-cyan-500/30",
    bgColor: "bg-cyan-500/10",
  },
  nuget: {
    name: "NuGet",
    icon: "🔷",
    color: "from-blue-600 to-indigo-700",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/10",
  },
  wordpress: {
    name: "WordPress",
    icon: "📝",
    color: "from-slate-500 to-slate-700",
    borderColor: "border-slate-500/30",
    bgColor: "bg-slate-500/10",
  },
  maven: {
    name: "Maven Central",
    icon: "☕",
    color: "from-amber-600 to-orange-700",
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/10",
  },
};

export function getSourceConfig(source: SourceType): SourceDisplayConfig {
  return SOURCE_CONFIGS[source];
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
    case "paperswithcode":
      return `https://paperswithcode.com/search?q=${q}`;
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
    default:
      return null;
  }
}
