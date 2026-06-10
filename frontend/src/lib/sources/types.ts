// Core data shapes shared across every source adapter, the ranking layer,
// and the React UI. Adapters MUST return UnifiedProject so the rest of the
// pipeline can treat every platform the same.

export type SourceType =
  | "github"
  | "huggingface"
  | "gitlab"
  | "npm"
  | "pypi"
  | "reddit"
  | "crates"
  | "hackernews"
  | "codeberg"
  | "packagist"
  | "rubygems"
  | "dockerhub"
  | "jsr"
  | "flathub"
  | "devto"
  | "lobsters"
  | "stackoverflow"
  | "homebrew"
  | "fdroid"
  | "arxiv"
  | "aur"
  | "openvsx"
  | "conda"
  | "zenodo"
  | "nuget"
  | "wordpress"
  | "maven"
  | "hex"
  | "pub"
  | "modrinth"
  | "cran"
  | "amo"
  | "greasyfork"
  | "terraform"
  | "snap"
  | "ansible"
  | "gnome"
  | "chocolatey"
  | "vcpkg"
  | "melpa";

export interface RelatedSource {
  source: SourceType;
  url: string;
  fullName: string;
  name: string;
}

export interface UnifiedProject {
  id: string;
  source: SourceType;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  stars: number;
  downloads?: number;
  language: string | null;
  topics: string[];
  author: {
    name: string;
    avatar: string;
  };
  updatedAt: string;
  readme?: string;
  license?: string;
  // Latest published version, when the upstream exposes one. Displayed as
  // a compact `v1.2.3` pill so users can decide freshness at a glance.
  version?: string;
  // Optional direct homepage for the project (a docs/marketing site),
  // separate from `url` (which points at the source-platform listing).
  homepage?: string;
  // Optional community/sentiment fields (Reddit, HN, Lobsters).
  sentiment?: "positive" | "mixed" | "negative" | "neutral";
  warning?: string;
  commentsCount?: number;
  // Same underlying project on other platforms (e.g. the npm package + the
  // GitHub repo + the PyPI binding). Populated by mergeRelatedProjects().
  relatedSources?: RelatedSource[];

  // --- Iteration 15 overhaul: richer metadata for the info-density card. ---
  // Each field is optional and adapters fill what they can; the card's
  // metric-grid renderer skips empty cells rather than padding with "—".

  // Repo-shape metrics (github / gitlab / codeberg)
  forks?: number;
  openIssues?: number;
  watchers?: number;
  // Repo lifecycle: archived/read-only repos are heavily de-prioritized in
  // ranking. pushedAt (last commit) is a truer activity/staleness signal than
  // updatedAt (which bumps on any metadata change, e.g. a new star).
  archived?: boolean;
  pushedAt?: string;

  // Package-shape metrics (npm / pypi / etc)
  weeklyDownloads?: number;
  // Upstream-computed popularity in [0,1] (e.g. npm search's
  // score.detail.popularity). An honest popularity signal for sources that
  // expose no star/download count; consumed by the ranker, never shown as a
  // star count in the UI.
  popularityScore?: number;
  // Latest publish timestamp (ISO). Distinct from `updatedAt` which on
  // package registries usually mirrors the latest release; some sources
  // expose both, some only one.
  lastPublished?: string;

  // Repo-activity signals (currently only github exposes these readily;
  // future enrichments can fill from a /stats endpoint)
  contributors?: number;
  commitsLastMonth?: number;

  // Paper-shape metrics (arxiv / zenodo)
  citations?: number;
  paperYear?: number;
  paperAuthors?: string[];

  // Thread-shape metrics (hn / reddit / lobsters / so / devto). `upvotes`
  // duplicates `stars` for thread sources (where stars semantically *is*
  // upvotes), but having an explicit field clarifies intent in the card.
  upvotes?: number;
  comments?: number;

  // Birth date — used by popularityClass() to detect "new" / "trending"
  // (high stars in short window) vs "established" (long-running).
  createdAt?: string;

  // --- Iteration 20 / Overhaul F: expanded-card preview-panel data. ---
  // All optional. Adapters fill what they can; the card hides empty
  // sections rather than showing placeholders. None of these trigger a
  // mandatory upstream call — the card may also fetch some on-expand
  // (e.g. readmeExcerpt for github) so the field can stay blank at first
  // paint and populate when the user opens the panel.

  // Recent releases — newest first. Currently unfilled by adapters; the
  // expanded panel reserves space and hides the section if empty.
  releases?: Array<{ version: string; date: string; url?: string }>;
  // Top languages by percent. e.g. { "TypeScript": 64.2, "CSS": 21.0 }
  languageBreakdown?: Record<string, number>;
  // Plain-text README excerpt (markdown stripped). Filled lazily on
  // expand for github/codeberg via lib/readme.ts; never blocks first
  // paint of the card.
  readmeExcerpt?: string;
  // Top comments / answers (HN, Reddit, SO). Each carries body + author.
  topComments?: Array<{ author: string; body: string; score?: number }>;
  // Subscribers / followers / watchers — distinct from `watchers` which
  // historically meant "GitHub stargazer pre-2012". Reserved for
  // subreddit/community subscriber counts.
  subscribersCount?: number;
}

export interface SearchResult {
  projects: UnifiedProject[];
  totalCount: number;
  source: SourceType;
  // Set when the source failed (network error, timeout, CORS, 5xx).
  // Adapter wrappers always swallow per-source errors so one slow / dead
  // upstream doesn't block the others — but the UI still wants to know
  // which sources didn't deliver, so it can offer a "3 sources unavailable"
  // affordance in the toolbar.
  error?: string;
}

export interface SearchProgressEvent {
  source: SourceType;
  projects: UnifiedProject[]; // ranked slice for this source alone
  done: boolean; // true once every source has completed
  remaining: number; // sources still in flight after this event
  error?: string; // populated if this source failed
}

export type SearchProgressCallback = (event: SearchProgressEvent) => void;
