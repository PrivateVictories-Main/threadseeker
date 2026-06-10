// Real vendor brand marks (simple-icons) for each source, so a mixed result
// grid is recognizable by logo — the npm red square, the PyPI snake, the Rust
// crab/gear, the Docker whale — instead of duplicated monochrome lucide glyphs.
// Each entry carries the SVG path, the official brand hex, and an optional
// `darkHex` for brands whose official color is near-black (and would vanish on
// our dark glass). Sources without a brand mark (Open VSX) fall back to the
// registry lucide icon via <SourceMark>.
import {
  siGithub, siHuggingface, siGitlab, siNpm, siPypi, siRust, siYcombinator,
  siCodeberg, siComposer, siRubygems, siReddit, siDocker, siJsr, siFlathub,
  siDevdotto, siLobsters, siStackoverflow, siHomebrew,
  siFdroid, siArxiv, siArchlinux, siCondaforge, siZenodo, siNuget, siWordpress,
  siApachemaven, siElixir, siDart, siModrinth, siR, siFirefox, siGreasyfork,
  siTerraform, siSnapcraft, siAnsible, siGnome, siChocolatey,
} from "simple-icons";
import type { SourceType } from "./types";

export interface BrandMark {
  /** SVG path data (24x24 viewBox). */
  path: string;
  /** Official brand hex (no leading #). */
  hex: string;
  /** Override color (with #) for dark mode when the brand hex is too dark. */
  darkHex?: string;
}

const m = (icon: { path: string; hex: string }, darkHex?: string): BrandMark => ({
  path: icon.path,
  hex: `#${icon.hex}`,
  darkHex,
});

// `Partial` — sources without a simple-icons mark (Open VSX, vcpkg, MELPA —
// checked against the installed simple-icons 2026-06-10) are simply absent
// here and fall back to their registry lucide glyph via <SourceMark>.
export const BRAND_ICONS: Partial<Record<SourceType, BrandMark>> = {
  github: m(siGithub, "#e6edf3"),
  huggingface: m(siHuggingface),
  gitlab: m(siGitlab),
  npm: m(siNpm),
  pypi: m(siPypi, "#5b9bd5"),
  crates: m(siRust, "#e6a06c"), // crates.io has no mark; Rust is the ecosystem
  hackernews: m(siYcombinator),
  codeberg: m(siCodeberg),
  packagist: m(siComposer, "#c89b6a"),
  rubygems: m(siRubygems),
  reddit: m(siReddit),
  dockerhub: m(siDocker),
  jsr: m(siJsr),
  flathub: m(siFlathub, "#cbd5e1"),
  devto: m(siDevdotto, "#e8e8e8"),
  lobsters: m(siLobsters, "#e0524d"),
  stackoverflow: m(siStackoverflow),
  homebrew: m(siHomebrew),
  fdroid: m(siFdroid),
  arxiv: m(siArxiv, "#e5484d"),
  aur: m(siArchlinux),
  conda: m(siCondaforge, "#5fbf4a"),
  zenodo: m(siZenodo, "#4ba3e3"),
  nuget: m(siNuget, "#4d9fe0"),
  wordpress: m(siWordpress, "#5aa7cf"),
  maven: m(siApachemaven, "#e0566b"),
  hex: m(siElixir, "#b388d4"),
  pub: m(siDart, "#4ab5f5"),
  modrinth: m(siModrinth),
  cran: m(siR, "#5b8fd6"),
  amo: m(siFirefox),
  greasyfork: m(siGreasyfork, "#e0645c"), // official #670000 vanishes on dark glass
  terraform: m(siTerraform, "#a07ee6"),
  snap: m(siSnapcraft),
  ansible: m(siAnsible, "#f25f5f"),
  gnome: m(siGnome, "#74a8e8"),
  chocolatey: m(siChocolatey),
};

export function getBrandMark(source: SourceType): BrandMark | undefined {
  return BRAND_ICONS[source];
}
