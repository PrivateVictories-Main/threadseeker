// Unified relevance score. Every adapter produces UnifiedProject; this layer
// is the single axis on which repos, packages, papers, and threads are
// ranked against each other, so all tuning lives here rather than getting
// sprinkled across 24 adapter files.

import { SourceType, UnifiedProject } from "./types";

export function calculateRelevanceScore(project: UnifiedProject, query: string): number {
  const q = query.toLowerCase().trim();
  const qWords = q.split(/\s+/).filter((w) => w.length > 1);
  const name = project.name.toLowerCase();
  const nameTokens = name.split(/[-_\s.]+/).filter(Boolean);
  let s = 0;

  // --- Name match (dominant signal) ---
  if (name === q) s += 15_000;
  else if (name.replace(/[-_\s.]/g, "") === q.replace(/[-_\s.]/g, "")) s += 12_000;
  else if (name.startsWith(q)) s += 8_000;
  else if (nameTokens.includes(q)) s += 5_000;
  else if (name.includes(q)) s += 3_000;

  if (qWords.length > 1) {
    const hits = qWords.filter((w) => nameTokens.some((n) => n.includes(w) || w.includes(n)));
    if (hits.length === qWords.length) s += 4_000;
    s += hits.length * 1_000;
  }

  for (const w of qWords) {
    for (const n of nameTokens) {
      if (n === w) s += 1_200;
      else if (n.startsWith(w)) s += 800;
      else if (n.includes(w)) s += 400;
    }
  }

  // --- Full path ---
  const full = project.fullName.toLowerCase();
  if (full.includes(q)) s += 600;
  for (const w of qWords) if (full.includes(w)) s += 250;

  // --- Description ---
  if (project.description) {
    const d = project.description.toLowerCase();
    if (d.includes(q)) s += 800;
    if (qWords.length > 1 && qWords.every((w) => d.includes(w))) s += 600;
    for (const w of qWords) {
      const hits = (d.match(new RegExp(w, "g")) || []).length;
      s += Math.min(hits * 150, 600);
    }
  }

  // --- Topics ---
  const topics = project.topics.map((t) => t.toLowerCase());
  s += topics.filter((t) => t === q).length * 2_000;
  s += topics.filter((t) => t.includes(q)).length * 800;
  for (const w of qWords) s += topics.filter((t) => t.includes(w)).length * 500;

  // --- Language match ---
  if (project.language) {
    const lang = project.language.toLowerCase();
    if (q.includes(lang) || lang.includes(q)) s += 600;
  }

  // --- Popularity (log-scaled, capped) ---
  if (project.stars > 0) {
    s += Math.min(Math.log10(project.stars + 1) * 200, 2_000);
    if (project.stars > 10_000) s += 500;
    if (project.stars > 50_000) s += 500;
  }
  if (project.downloads && project.downloads > 0) {
    s += Math.min(Math.log10(project.downloads + 1) * 150, 1_500);
  }

  // --- Recency ---
  const ageDays = (Date.now() - new Date(project.updatedAt).getTime()) / 86_400_000;
  if (ageDays < 7) s += 500;
  else if (ageDays < 30) s += 300;
  else if (ageDays < 90) s += 150;
  else if (ageDays > 730) s -= 500;
  else if (ageDays > 365) s -= 200;

  // --- Source baseline ---
  const srcBonus: Record<SourceType, number> = {
    github: 150, huggingface: 140, npm: 120, pypi: 120, crates: 120,
    packagist: 110, rubygems: 110, gitlab: 100, codeberg: 100,
    dockerhub: 120, jsr: 110, flathub: 105,
    homebrew: 110, fdroid: 100, arxiv: 110,
    paperswithcode: 115, stackoverflow: 95,
    hackernews: 90, reddit: 90, lobsters: 90, devto: 85,
    aur: 100, openvsx: 110, conda: 115,
    zenodo: 105, nuget: 120, wordpress: 105,
  };
  s += srcBonus[project.source] ?? 0;

  // --- Quality signals ---
  if (project.description && project.description.length > 50) s += 150;
  if (project.topics.length > 3) s += 100;

  // --- Trending: actively maintained AND popular ---
  if (project.stars >= 1_000 && ageDays < 90) s += 800;
  if (project.stars >= 10_000 && ageDays < 180) s += 400;

  // --- Abandonment penalty ---
  if (ageDays > 365 * 3 && project.stars < 500) s -= 400;

  // --- Zero-signal penalty ---
  const noStars = project.stars === 0;
  const noDownloads = !project.downloads || project.downloads === 0;
  const noDesc = !project.description || project.description.length < 20;
  if (noStars && noDownloads && noDesc) s -= 600;

  // --- All query terms present (whole-token) in name OR description ---
  if (qWords.length >= 2) {
    const d = (project.description || "").toLowerCase();
    const haystack = new Set([...nameTokens, ...d.split(/[^a-z0-9]+/).filter(Boolean)]);
    const allHit = qWords.every((w) => haystack.has(w));
    if (allHit) s += 1_500;
  }

  // --- Intent token boosts ---
  // When the query mentions an ecosystem ("react", "python", "rust"),
  // strongly prefer projects whose language or source matches.
  const LANG_INTENT: Record<string, { lang?: string[]; sources?: SourceType[] }> = {
    python: { lang: ["python"], sources: ["pypi"] },
    py: { lang: ["python"], sources: ["pypi"] },
    javascript: { lang: ["javascript", "typescript"], sources: ["npm", "jsr"] },
    js: { lang: ["javascript", "typescript"], sources: ["npm", "jsr"] },
    typescript: { lang: ["typescript"], sources: ["npm", "jsr"] },
    ts: { lang: ["typescript"], sources: ["npm", "jsr"] },
    rust: { lang: ["rust"], sources: ["crates"] },
    go: { lang: ["go"] },
    golang: { lang: ["go"] },
    ruby: { lang: ["ruby"], sources: ["rubygems"] },
    php: { lang: ["php"], sources: ["packagist", "wordpress"] },
    wordpress: { lang: ["php"], sources: ["wordpress", "packagist"] },
    dotnet: { lang: ["c#", "f#", "visual basic"], sources: ["nuget"] },
    csharp: { lang: ["c#"], sources: ["nuget"] },
    "c#": { lang: ["c#"], sources: ["nuget"] },
    react: { lang: ["javascript", "typescript"] },
    vue: { lang: ["javascript", "typescript"] },
    svelte: { lang: ["javascript", "typescript"] },
  };
  for (const w of qWords) {
    const intent = LANG_INTENT[w];
    if (!intent) continue;
    if (project.language && intent.lang?.some((l) => project.language!.toLowerCase() === l)) {
      s += 600;
    }
    if (intent.sources?.includes(project.source)) s += 300;
  }

  return Math.max(0, s);
}
