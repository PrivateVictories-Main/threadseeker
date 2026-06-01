import type { SourceType } from "@/lib/sources/types";
import { getSourceIcon } from "@/lib/sources/registry";

const LABELS: Record<SourceType, string> = {
  github: "GitHub", huggingface: "Hugging Face", gitlab: "GitLab",
  codeberg: "Codeberg", npm: "npm", pypi: "PyPI", crates: "crates.io",
  packagist: "Packagist", rubygems: "RubyGems", jsr: "JSR",
  dockerhub: "Docker Hub", flathub: "Flathub", homebrew: "Homebrew",
  fdroid: "F-Droid", aur: "AUR", openvsx: "Open VSX", conda: "conda-forge",
  nuget: "NuGet", wordpress: "WordPress", maven: "Maven",
  paperswithcode: "Papers with Code", arxiv: "arXiv", zenodo: "Zenodo",
  hackernews: "Hacker News", reddit: "Reddit", lobsters: "Lobsters",
  stackoverflow: "Stack Overflow", devto: "DEV",
};

export function SourceBadge({ source }: { source: SourceType }) {
  const Icon = getSourceIcon(source);
  return (
    <span className={`ts-source ts-source-${source}`} aria-label={`Source: ${LABELS[source]}`}>
      <Icon className="ts-source-icon" aria-hidden />
      {LABELS[source]}
    </span>
  );
}
