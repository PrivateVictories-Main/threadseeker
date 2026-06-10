// Cross-source de-duplication. A single "project" (e.g. fastapi) often shows
// up as a GitHub repo, a PyPI package, a Docker image, and a conda package.
// Instead of four cards, fold them into one and surface the siblings as
// related-source chips.

import { RelatedSource, SourceType, UnifiedProject } from "./types";

// Thread-like sources are kept out of dedup — a Reddit thread about `next.js`
// is not the same thing as the npm package.
const DEDUPABLE_SOURCES: ReadonlySet<SourceType> = new Set<SourceType>([
  "github",
  "gitlab",
  "codeberg",
  "huggingface",
  "npm",
  "pypi",
  "crates",
  "packagist",
  "rubygems",
  "jsr",
  "dockerhub",
  "flathub",
  "homebrew",
  "fdroid",
  "aur",
  "openvsx",
  "conda",
  "nuget",
  "wordpress",
  "maven",
  // cran + chocolatey are real package registries distributing the same
  // upstream projects as the rest of the dedup pool. The other Iter-25
  // additions (modrinth/amo/greasyfork/gnome/snap/terraform/ansible) are
  // apps/extensions or namespaced modules where cross-source folding would
  // only produce false merges — they stay standalone.
  "cran",
  "chocolatey",
  // vcpkg + melpa (Iter-26) are real package registries distributing the
  // same upstream projects (fmt/abseil on GitHub, magit's repo, …) — they
  // belong in the dedup pool like homebrew/cran.
  "vcpkg",
  "melpa",
]);

// Normalize a project's name for comparison: strip scopes, cases, separators,
// and common noise prefixes so `@react/next-auth`, `next-auth`, and
// `nextauth` collapse to the same fingerprint.
function projectFingerprint(p: UnifiedProject): string {
  let s = p.name.toLowerCase();
  s = s.replace(/^@[^/]+\//, ""); // strip npm-style scope
  s = s.replace(/^(python-|py-|node-|rust-|ruby-|go-)/, "");
  s = s.replace(/(-python|-py|-node|-rust|-ruby|-go|-official)$/, "");
  s = s.replace(/[-_.\s]+/g, "");
  return s;
}

export function mergeRelatedProjects(projects: UnifiedProject[]): UnifiedProject[] {
  const groups = new Map<string, UnifiedProject[]>();
  const standalone: UnifiedProject[] = [];

  for (const p of projects) {
    if (!DEDUPABLE_SOURCES.has(p.source)) {
      standalone.push(p);
      continue;
    }
    const fp = projectFingerprint(p);
    if (!fp) {
      standalone.push(p);
      continue;
    }
    const bucket = groups.get(fp);
    if (bucket) bucket.push(p);
    else groups.set(fp, [p]);
  }

  // Canonical-source priority for picking the primary card of a merged group.
  // Repos first, then primary package registries, then app stores / model hubs,
  // then papers, then community threads. This avoids comparing incommensurable
  // numbers (a 50k-star HF model vs a 1M-download npm pkg) across sources — the
  // numeric popularity tiebreak only applies WITHIN the same source.
  const sourceRank: Record<string, number> = {
    github: 100, gitlab: 90, codeberg: 80,
    npm: 72, pypi: 72, crates: 72, maven: 68, nuget: 68, rubygems: 66, packagist: 66,
    conda: 62, huggingface: 60, jsr: 56, hex: 56, cran: 62, terraform: 58, ansible: 56,
    dockerhub: 52, homebrew: 50, flathub: 50, fdroid: 48, openvsx: 46, aur: 44, wordpress: 40,
    chocolatey: 50, snap: 50, modrinth: 48, amo: 46, greasyfork: 44, gnome: 42,
    vcpkg: 60, melpa: 50,
    arxiv: 30, zenodo: 26,
    stackoverflow: 12, hackernews: 10, reddit: 10, lobsters: 10, devto: 10,
  };
  const popSignal = (p: UnifiedProject) =>
    p.stars || p.downloads || p.weeklyDownloads || 0;

  const merged: UnifiedProject[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      merged.push(bucket[0]);
      continue;
    }

    // Further split: projects in the same fingerprint bucket must share a
    // description word ≥4 chars OR one of them must be a repo (which is
    // treated as canonical).
    const subgroups = splitByAffinity(bucket);
    for (const sub of subgroups) {
      if (sub.length === 1) {
        merged.push(sub[0]);
        continue;
      }
      const primary = [...sub].sort((a, b) => {
        const ra = sourceRank[a.source] ?? 0;
        const rb = sourceRank[b.source] ?? 0;
        if (ra !== rb) return rb - ra;
        // same (or equal-rank) source → compare a consistent popularity unit
        return popSignal(b) - popSignal(a);
      })[0];

      const related: RelatedSource[] = sub
        .filter((p) => p.id !== primary.id)
        .map((p) => ({
          source: p.source,
          url: p.url,
          fullName: p.fullName,
          name: p.name,
        }));

      merged.push({ ...primary, relatedSources: related });
    }
  }

  return [...merged, ...standalone];
}

const REPO_SOURCES = ["github", "gitlab", "codeberg"] as const;

function splitByAffinity(group: UnifiedProject[]): UnifiedProject[][] {
  const word = (s: string | null) =>
    new Set(
      (s || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4),
    );

  // Repo-anchored bucket: the repo is canonical, but membership still has to
  // be EARNED. Generic fingerprints ("cron", "json") otherwise fold npm cron,
  // pypi cron, and an unrelated GitHub repo named cron into one card, and the
  // losers vanish into wrong "related sources" chips — silently deleting
  // correct answers. A non-repo member joins the repo's group only when it
  // shares a ≥4-char description word with the repo OR its owner matches the
  // repo owner (the scoped-package case). Everything else stays standalone.
  const anchor = group.find((p) =>
    (REPO_SOURCES as readonly string[]).includes(p.source),
  );
  if (anchor) {
    const anchorWords = word(anchor.description);
    const anchorOwner = (anchor.fullName.split("/")[0] || "").toLowerCase();
    const joined: UnifiedProject[] = [anchor];
    const rest: UnifiedProject[] = [];
    for (const p of group) {
      if (p.id === anchor.id) continue;
      const owner = (p.fullName.split("/")[0] || p.author?.name || "").toLowerCase();
      const shares =
        [...word(p.description)].some((w) => anchorWords.has(w)) ||
        (owner.length > 1 && owner === anchorOwner) ||
        (!p.description && !anchor.description);
      if (shares) joined.push(p);
      else rest.push(p);
    }
    // The leftovers may still be related to EACH OTHER (e.g. the npm and pypi
    // "cron" that genuinely wrap the same upstream) — recurse without the repo.
    return rest.length > 0
      ? [joined, ...splitByAffinity(rest)]
      : [joined];
  }

  const used = new Set<string>();
  const out: UnifiedProject[][] = [];
  for (const p of group) {
    if (used.has(p.id)) continue;
    used.add(p.id);
    const sub = [p];
    const words = word(p.description);
    for (const q of group) {
      if (used.has(q.id)) continue;
      const qWords = word(q.description);
      const overlap = [...words].some((w) => qWords.has(w));
      if (overlap || (!p.description && !q.description)) {
        used.add(q.id);
        sub.push(q);
      }
    }
    out.push(sub);
  }
  return out;
}
