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

  // Exact-name is the strongest single signal, but a 5-star repo named
  // exactly "orm" is almost certainly not what the user wants. Scale by
  // popularity so unknown namesakes don't win conceptual queries.
  const starsForScale = Math.max(project.stars, 1);
  const popScale = Math.min(
    1,
    0.35 + Math.log10(starsForScale + 1) / 6, // 0 stars = .35, 1K = .85, 100K = 1.0
  );
  // Multi-word queries are usually describing a concept ("http client"),
  // not a project name, so name-match bonuses should carry less weight.
  const multiWordDamp = qWords.length >= 2 ? 0.55 : 1.0;
  const nameScale = popScale * multiWordDamp;

  // --- Name match (dominant signal) ---
  if (name === q) s += 15_000 * nameScale;
  else if (name.replace(/[-_\s.]/g, "") === q.replace(/[-_\s.]/g, "")) s += 12_000 * nameScale;
  else if (name.startsWith(q)) s += 8_000 * nameScale;
  else if (nameTokens.includes(q)) s += 5_000 * nameScale;
  else if (name.includes(q)) s += 3_000 * nameScale;

  // "All query words appear somewhere in the name" — cheap bonus, but
  // keeping it high means repos called "<query>-benchmark" or
  // "<query>-tutorial" crowd out canonical answers. Keep modest.
  if (qWords.length > 1) {
    const hits = qWords.filter((w) => nameTokens.some((n) => n.includes(w) || w.includes(n)));
    if (hits.length === qWords.length) s += 1_500;
    s += hits.length * 500;
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
  // Raised from 800/600 — conceptual queries ("orm", "http client") must
  // be able to ride description matches past obscure exact-name repos.
  if (project.description) {
    const d = project.description.toLowerCase();
    if (d.includes(q)) s += 1_500;
    if (qWords.length > 1 && qWords.every((w) => d.includes(w))) s += 1_500;
    for (const w of qWords) {
      const hits = (d.match(new RegExp(w, "g")) || []).length;
      s += Math.min(hits * 200, 800);
    }
  }

  // --- Topics ---
  // Topics are a curation signal (the maintainer tagged it), so we boost
  // — but not so much that a 2k-star project tagged with the query beats
  // a 200k-star canonical that didn't bother tagging.
  const topics = project.topics.map((t) => t.toLowerCase());
  s += topics.filter((t) => t === q).length * 2_500;
  s += topics.filter((t) => t.includes(q)).length * 1_000;
  for (const w of qWords) s += topics.filter((t) => t.includes(w)).length * 600;

  // --- Language match ---
  if (project.language) {
    const lang = project.language.toLowerCase();
    if (q.includes(lang) || lang.includes(q)) s += 600;
  }

  // --- Popularity (log-scaled, plus tiered bonuses) ---
  // Stellar projects need room to out-rank obscure exact-name matches on
  // conceptual queries; tiers are additive so famous-and-on-topic wins.
  if (project.stars > 0) {
    s += Math.min(Math.log10(project.stars + 1) * 400, 3_500);
    if (project.stars >= 10_000) s += 1_500;
    if (project.stars >= 50_000) s += 2_000;
    if (project.stars >= 100_000) s += 1_500;
  }
  if (project.downloads && project.downloads > 0) {
    s += Math.min(Math.log10(project.downloads + 1) * 200, 2_000);
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
    zenodo: 105, nuget: 120, wordpress: 105, maven: 120,
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
    java: { lang: ["java"], sources: ["maven"] },
    kotlin: { lang: ["kotlin", "java"], sources: ["maven"] },
    scala: { lang: ["scala", "java"], sources: ["maven"] },
    jvm: { lang: ["java", "kotlin", "scala"], sources: ["maven"] },
    android: { lang: ["java", "kotlin"], sources: ["maven", "fdroid"] },
    gradle: { lang: ["java", "kotlin"], sources: ["maven"] },
    maven: { lang: ["java"], sources: ["maven"] },
    react: { lang: ["javascript", "typescript"] },
    vue: { lang: ["javascript", "typescript"] },
    svelte: { lang: ["javascript", "typescript"] },
  };
  for (const w of qWords) {
    const intent = LANG_INTENT[w];
    if (!intent) continue;
    if (project.language && intent.lang?.some((l) => project.language!.toLowerCase() === l)) {
      s += 1_200;
    }
    if (intent.sources?.includes(project.source)) s += 600;
  }

  return Math.max(0, s);
}
