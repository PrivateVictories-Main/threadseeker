export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  owner: {
    login: string;
    avatar_url: string;
  };
  topics: string[];
  updated_at: string;
  default_branch: string;
}

export interface SearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
}

export interface GitHubError {
  message: string;
  documentation_url?: string;
}

export async function searchRepositories(
  query: string,
  page: number = 1,
  perPage: number = 12
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    page: page.toString(),
    per_page: perPage.toString(),
  });

  const response = await fetch(
    `https://api.github.com/search/repositories?${params}`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 403) {
      const error: GitHubError = await response.json();
      if (error.message.includes("rate limit")) {
        throw new Error("RATE_LIMIT");
      }
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

export async function getReadme(
  owner: string,
  repo: string,
  branch: string = "main"
): Promise<string | null> {
  // Try common README filenames
  const readmeNames = ["README.md", "readme.md", "Readme.md", "README.MD"];

  for (const filename of readmeNames) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filename}`
      );

      if (response.ok) {
        return response.text();
      }
    } catch {
      continue;
    }
  }

  // Try the default branch if provided branch didn't work
  if (branch !== "main" && branch !== "master") {
    for (const fallbackBranch of ["main", "master"]) {
      for (const filename of readmeNames) {
        try {
          const response = await fetch(
            `https://raw.githubusercontent.com/${owner}/${repo}/${fallbackBranch}/${filename}`
          );

          if (response.ok) {
            return response.text();
          }
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

export function getLanguageColor(language: string | null): string {
  const colors: Record<string, string> = {
    JavaScript: "#f7df1e",
    TypeScript: "#3178c6",
    Python: "#3572A5",
    Java: "#b07219",
    Go: "#00ADD8",
    Rust: "#dea584",
    Ruby: "#701516",
    PHP: "#4F5D95",
    "C++": "#f34b7d",
    C: "#555555",
    "C#": "#178600",
    Swift: "#ffac45",
    Kotlin: "#A97BFF",
    Dart: "#00B4AB",
    Vue: "#41b883",
    HTML: "#e34c26",
    CSS: "#563d7c",
    Shell: "#89e051",
    Lua: "#000080",
  };

  return colors[language || ""] || "#8b8b8b";
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count !== 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
}



