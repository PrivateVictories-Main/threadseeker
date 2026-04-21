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
  | "paperswithcode"
  | "homebrew"
  | "fdroid"
  | "arxiv"
  | "aur"
  | "openvsx"
  | "conda"
  | "zenodo"
  | "nuget"
  | "wordpress";

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
  // Optional community/sentiment fields (Reddit, HN, Lobsters).
  sentiment?: "positive" | "mixed" | "negative" | "neutral";
  warning?: string;
  commentsCount?: number;
  // Same underlying project on other platforms (e.g. the npm package + the
  // GitHub repo + the PyPI binding). Populated by mergeRelatedProjects().
  relatedSources?: RelatedSource[];
}

export interface SearchResult {
  projects: UnifiedProject[];
  totalCount: number;
  source: SourceType;
}

export interface SearchProgressEvent {
  source: SourceType;
  projects: UnifiedProject[]; // ranked slice for this source alone
  done: boolean; // true once every source has completed
  remaining: number; // sources still in flight after this event
}

export type SearchProgressCallback = (event: SearchProgressEvent) => void;
