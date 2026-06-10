// Golden upstream payloads — one block per source adapter.
//
// Each payload mirrors the EXACT envelope + item fields the corresponding
// adapter in ../adapters.ts reads, with shapes spot-verified against the live
// public APIs (June 2026) for the trickier sources (WordPress, Flathub, JSR,
// hex.pm, anaconda.org, pub.dev). Two items per source (plus deliberate
// edge-variants like a null GitHub owner), trimmed to the mapped fields and a
// little realistic context. Consumed only by ../adapters.test.ts.

// --- Repo hosts ---

export const githubSearch = {
  total_count: 2,
  incomplete_results: false,
  items: [
    {
      id: 10270250,
      name: "react",
      full_name: "facebook/react",
      owner: {
        login: "facebook",
        avatar_url: "https://avatars.githubusercontent.com/u/69631?v=4",
      },
      html_url: "https://github.com/facebook/react",
      description: "The library for web and native user interfaces.",
      stargazers_count: 230_000,
      language: "JavaScript",
      topics: ["react", "frontend", "ui"],
      updated_at: "2026-06-01T12:00:00Z",
      created_at: "2013-05-24T16:15:54Z",
      pushed_at: "2026-06-01T11:00:00Z",
      license: { key: "mit", name: "MIT License", spdx_id: "MIT" },
      homepage: "https://react.dev",
      forks_count: 47_000,
      open_issues_count: 800,
      watchers_count: 230_000,
      archived: false,
    },
    {
      id: 70107786,
      name: "next.js",
      full_name: "vercel/next.js",
      // Deleted/suspended owner — exercises the owner?.login fallback the
      // adapter calls out in its own comments.
      owner: null,
      html_url: "https://github.com/vercel/next.js",
      description: "The React Framework",
      stargazers_count: 125_000,
      language: "TypeScript",
      topics: [],
      updated_at: "2026-05-30T08:00:00Z",
      created_at: "2016-10-05T00:32:16Z",
      pushed_at: "2026-05-30T07:00:00Z",
      license: { key: "mit", name: "MIT License", spdx_id: "MIT" },
      homepage: "",
      forks_count: 27_000,
      open_issues_count: 3_000,
      watchers_count: 125_000,
      archived: false,
    },
  ],
};

export const gitlabProjects = [
  {
    id: 278964,
    name: "GitLab",
    path_with_namespace: "gitlab-org/gitlab",
    description: "GitLab is an open source end-to-end software development platform.",
    web_url: "https://gitlab.com/gitlab-org/gitlab",
    star_count: 24_000,
    topics: ["devops", "ci"],
    tag_list: ["devops", "ci"],
    namespace: {
      name: "GitLab.org",
      avatar_url: "https://gitlab.com/uploads/-/system/group/avatar/9970/logo.png",
    },
    last_activity_at: "2026-06-02T09:00:00Z",
    created_at: "2015-01-01T00:00:00Z",
    forks_count: 5_700,
    open_issues_count: 40_000,
  },
  {
    id: 4207231,
    name: "Inkscape",
    path_with_namespace: "inkscape/inkscape",
    description: "Inkscape vector image editor",
    web_url: "https://gitlab.com/inkscape/inkscape",
    star_count: 3_700,
    topics: [],
    tag_list: [],
    // No namespace avatar / owner — exercises the "Unknown" fallback chain.
    namespace: null,
    owner: null,
    last_activity_at: "2026-05-20T10:30:00Z",
    created_at: "2017-06-09T14:02:00Z",
    forks_count: 1_100,
    open_issues_count: 2_300,
  },
];

export const codebergSearch = {
  ok: true,
  data: [
    {
      id: 2171,
      name: "forgejo",
      full_name: "forgejo/forgejo",
      description: "Beyond coding. We forge.",
      html_url: "https://codeberg.org/forgejo/forgejo",
      stars_count: 5_200,
      language: "Go",
      topics: ["git", "forge"],
      owner: {
        login: "forgejo",
        avatar_url: "https://codeberg.org/avatars/forgejo",
      },
      updated_at: "2026-06-01T07:00:00Z",
      created_at: "2022-11-15T12:00:00Z",
      forks_count: 800,
      open_issues_count: 1_200,
    },
    {
      id: 12345,
      name: "tinylog",
      full_name: "alice/tinylog",
      description: null,
      html_url: "https://codeberg.org/alice/tinylog",
      stars_count: 0,
      language: null,
      owner: { login: "alice", avatar_url: "" },
      updated_at: "2025-12-01T00:00:00Z",
      created_at: "2025-11-01T00:00:00Z",
      forks_count: 0,
      open_issues_count: 0,
    },
  ],
};

// --- AI/ML registries ---

export const hfModels = [
  {
    _id: "66f1a001",
    id: "meta-llama/Llama-3.1-8B-Instruct",
    likes: 4_200,
    downloads: 9_800_000,
    library_name: "transformers",
    pipeline_tag: "text-generation",
    tags: ["llama", "text-generation", "pytorch"],
    createdAt: "2024-07-18T08:00:00.000Z",
    lastModified: "2026-05-01T10:00:00.000Z",
    license: "llama3.1",
  },
  {
    _id: "66f1a002",
    id: "openai/whisper-large-v3",
    likes: 3_100,
    downloads: 6_500_000,
    library_name: "transformers",
    pipeline_tag: "automatic-speech-recognition",
    tags: ["whisper", "audio"],
    createdAt: "2023-11-07T00:00:00.000Z",
    lastModified: "2026-01-15T00:00:00.000Z",
  },
];

export const hfDatasets = [
  {
    _id: "66f1b001",
    id: "HuggingFaceFW/fineweb",
    likes: 1_900,
    downloads: 350_000,
    tags: ["text", "pretraining"],
    createdAt: "2024-04-19T00:00:00.000Z",
    lastModified: "2026-03-01T00:00:00.000Z",
  },
];

// --- pub.dev (search returns names only; details fetched per name) ---

export const pubSearch = {
  packages: [{ package: "http" }, { package: "dio" }],
  next: "https://pub.dev/api/search?q=http&page=2",
};

export const pubDetailHttp = {
  name: "http",
  latest: {
    version: "1.6.0",
    published: "2025-11-10T18:27:56.434747Z",
    pubspec: {
      name: "http",
      description:
        "A composable, multi-platform, Future-based API for HTTP requests.",
      repository: "https://github.com/dart-lang/http/tree/master/pkgs/http",
      topics: ["http", "network", "protocols"],
    },
  },
};

export const pubDetailDio = {
  name: "dio",
  latest: {
    version: "5.7.0",
    published: "2025-09-20T03:11:00.000000Z",
    pubspec: {
      name: "dio",
      description: "A powerful HTTP networking package for Dart/Flutter.",
      homepage: "https://github.com/cfug/dio",
      topics: ["http", "dio"],
    },
  },
};

// --- Backend-indexed sources (Pages Functions payloads) ---

export const arxivBackend = {
  results: [
    {
      id: "https://arxiv.org/abs/1706.03762",
      url: "https://arxiv.org/abs/1706.03762",
      title: "Attention Is All You Need",
      summary:
        "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...",
      published: "2017-06-12T17:57:34Z",
      updated: "2023-08-02T00:41:18Z",
      authors: ["Ashish Vaswani", "Noam Shazeer"],
      categories: ["cs.CL", "cs.LG"],
    },
    {
      id: "https://arxiv.org/abs/2406.01234",
      url: "https://arxiv.org/abs/2406.01234",
      title: "A Survey of Retrieval-Augmented Generation",
      summary: "We survey RAG systems...",
      published: "2024-06-03T09:00:00Z",
      updated: "2024-06-03T09:00:00Z",
      authors: ["Jane Doe"],
      categories: ["cs.IR"],
    },
  ],
};

export const homebrewBackend = {
  results: [
    {
      kind: "formula",
      full_token: "wget",
      name: "wget",
      desc: "Internet file retriever",
      homepage: "https://www.gnu.org/software/wget/",
      tap: "homebrew/core",
      version: "1.24.5",
    },
    {
      kind: "cask",
      full_token: "iterm2",
      name: "iTerm2",
      desc: "Terminal emulator as alternative to Apple's Terminal app",
      homepage: "https://iterm2.com/",
      tap: "homebrew/cask",
      version: "3.5.10",
    },
  ],
};

export const fdroidBackend = {
  results: [
    {
      id: "org.fdroid.fdroid",
      name: "F-Droid",
      summary: "The app store that respects freedom and privacy",
      description: "F-Droid is an installable catalogue of FOSS applications...",
      categories: ["System"],
      author: "F-Droid Limited",
      icon: "https://f-droid.org/repo/icons/org.fdroid.fdroid.png",
      updated: "2026-05-10T00:00:00Z",
      license: "GPL-3.0-or-later",
    },
    {
      id: "org.schabi.newpipe",
      name: "NewPipe",
      summary: "Lightweight YouTube frontend",
      categories: ["Multimedia", "Internet"],
      updated: "2026-04-22T00:00:00Z",
      license: "GPL-3.0-only",
    },
  ],
};

export const redditBackend = {
  results: [
    {
      title: "What Rust web framework do you actually use in production?",
      url: "https://www.reddit.com/r/rust/comments/1abcde/what_rust_web_framework/",
      subreddit: "rust",
      score: 540,
      num_comments: 230,
      created_utc: 1748000000,
      selftext: "Axum vs Actix vs Rocket — looking for real-world experience.",
      community_sentiment: "positive",
      has_warning: false,
    },
    {
      title: "Show /r/selfhosted: my new dashboard",
      url: "https://www.reddit.com/r/selfhosted/comments/1fghij/show_dashboard/",
      subreddit: "selfhosted",
      score: 120,
      num_comments: 45,
      created_utc: 1747000000,
      selftext: "",
      community_sentiment: "mixed",
      has_warning: true,
      warning_reason: "Several commenters report data-loss bugs",
    },
  ],
};

// (Papers with Code fixture removed 2026-06 — the service shut down and the
// API now 302s to huggingface.co, so the adapter was deleted outright.)

// --- Language package registries ---

export const npmSearch = {
  total: 2,
  objects: [
    {
      downloads: { monthly: 120_000_000, weekly: 28_000_000 },
      package: {
        name: "express",
        version: "4.21.2",
        description: "Fast, unopinionated, minimalist web framework",
        keywords: ["express", "framework", "web"],
        date: "2025-11-01T12:00:00.000Z",
        license: "MIT",
        links: {
          npm: "https://www.npmjs.com/package/express",
          homepage: "https://expressjs.com/",
          repository: "https://github.com/expressjs/express",
        },
        publisher: { username: "wesleytodd", email: "wes@wesleytodd.com" },
      },
      score: {
        final: 0.93,
        detail: { quality: 0.96, popularity: 0.91, maintenance: 0.92 },
      },
      searchScore: 100_000,
    },
    {
      downloads: { monthly: 9_000_000, weekly: 2_100_000 },
      package: {
        name: "fastify",
        version: "5.2.0",
        description: "Fast and low overhead web framework, for Node.js",
        keywords: ["web", "framework", "json"],
        date: "2026-01-15T09:30:00.000Z",
        license: "MIT",
        links: {
          npm: "https://www.npmjs.com/package/fastify",
          repository: "https://github.com/fastify/fastify",
        },
        // No publisher — exercises the author?.name fallback.
        author: { name: "Matteo Collina" },
      },
      score: {
        final: 0.88,
        detail: { quality: 0.95, popularity: 0.78, maintenance: 0.93 },
      },
      searchScore: 90_000,
    },
  ],
};

export const pypiFastapi = {
  info: {
    name: "fastapi",
    version: "0.115.12",
    summary: "FastAPI framework, high performance, easy to learn",
    project_url: "https://pypi.org/project/fastapi/",
    home_page: "",
    keywords: "fastapi, api, framework",
    author: "Sebastián Ramírez",
    license: "MIT",
  },
  releases: {
    "0.115.12": [{ upload_time_iso_8601: "2026-03-23T22:00:00.000000Z" }],
  },
  urls: [{ upload_time_iso_8601: "2026-03-23T22:00:00.000000Z" }],
};

export const pypiFlask = {
  info: {
    name: "Flask",
    version: "3.1.0",
    summary: "A simple framework for building complex web applications.",
    project_url: "https://pypi.org/project/Flask/",
    home_page: "https://flask.palletsprojects.com/",
    // PyPI keywords may be null — exercises the ?.split guard.
    keywords: null,
    author: "",
    license: "BSD-3-Clause",
  },
  releases: {
    "3.1.0": [{ upload_time_iso_8601: "2025-11-13T18:24:00.000000Z" }],
  },
  urls: [],
};

export const cratesSearch = {
  crates: [
    {
      id: "tokio",
      name: "tokio",
      description:
        "An event-driven, non-blocking I/O platform for writing asynchronous I/O backed applications.",
      downloads: 280_000_000,
      recent_downloads: 18_000_000,
      max_stable_version: "1.43.0",
      newest_version: "1.43.0",
      updated_at: "2026-05-12T14:00:00.000000Z",
      created_at: "2016-07-01T20:00:00.000000Z",
      homepage: "https://tokio.rs",
      documentation: "https://docs.rs/tokio",
      repository: "https://github.com/tokio-rs/tokio",
      // crates.io list responses carry null keywords/categories.
      keywords: null,
      categories: null,
    },
    {
      id: "serde",
      name: "serde",
      description: "A generic serialization/deserialization framework",
      downloads: 450_000_000,
      max_stable_version: "1.0.218",
      newest_version: "1.0.218",
      updated_at: "2026-02-01T00:00:00.000000Z",
      created_at: "2014-12-05T00:00:00.000000Z",
      homepage: "https://serde.rs",
      documentation: "https://docs.rs/serde",
      repository: "https://github.com/serde-rs/serde",
      keywords: null,
      categories: null,
      license: "MIT OR Apache-2.0",
    },
  ],
  meta: { total: 2 },
};

export const packagistSearch = {
  total: 2,
  results: [
    {
      name: "monolog/monolog",
      description: "Sends your logs to files, sockets, inboxes, databases...",
      url: "https://packagist.org/packages/monolog/monolog",
      repository: "https://github.com/Seldaek/monolog",
      downloads: 800_000_000,
      favers: 21_000,
    },
    {
      name: "guzzlehttp/guzzle",
      description: "Guzzle is a PHP HTTP client library",
      url: "https://packagist.org/packages/guzzlehttp/guzzle",
      repository: "https://github.com/guzzle/guzzle",
      downloads: 700_000_000,
      favers: 23_000,
    },
  ],
};

export const rubygemsSearch = [
  {
    name: "rails",
    info: "Ruby on Rails is a full-stack web framework.",
    version: "8.0.2",
    downloads: 600_000_000,
    authors: "David Heinemeier Hansson, Rails Core Team",
    licenses: ["MIT"],
    version_created_at: "2026-03-12T18:00:00.000Z",
    homepage_uri: "https://rubyonrails.org",
    source_code_uri: "https://github.com/rails/rails",
  },
  {
    name: "sinatra",
    info: "Sinatra is a DSL for quickly creating web applications in Ruby.",
    version: "4.1.1",
    downloads: 200_000_000,
    // Missing authors / licenses — exercises the fallbacks.
    authors: null,
    licenses: null,
    version_created_at: "2025-08-01T00:00:00.000Z",
    homepage_uri: "http://sinatrarb.com/",
  },
];

export const jsrSearch = {
  total: 2,
  items: [
    {
      scope: "std",
      name: "http",
      description: "A collection of HTTP utilities for Deno and the web",
      score: 94,
      updatedAt: "2026-05-20T10:00:00.000Z",
      createdAt: "2024-03-01T00:00:00.000Z",
      latestVersion: "1.0.13",
      runtimeCompat: { browser: true, deno: true, node: true },
    },
    {
      scope: "oak",
      name: "oak",
      description: "A middleware framework for handling HTTP",
      score: 88,
      updatedAt: "2026-02-10T00:00:00.000Z",
      createdAt: "2024-02-15T00:00:00.000Z",
      latestVersion: "17.1.4",
    },
  ],
};

// --- Container / app / OS package catalogues ---

export const dockerhubSearch = {
  count: 2,
  results: [
    {
      // Official image — no slash; adapter maps owner to "library" and the
      // URL to the /_/<name> form.
      repo_name: "nginx",
      short_description: "Official build of Nginx.",
      star_count: 20_000,
      pull_count: 10_000_000_000,
      last_updated: "2026-06-01T03:00:00.000000Z",
    },
    {
      repo_name: "bitnami/nginx",
      short_description: "Bitnami container image for NGINX",
      star_count: 200,
      pull_count: 1_000_000_000,
      last_updated: "2026-05-28T00:00:00.000000Z",
    },
  ],
};

// Shape of POST https://flathub.org/api/v2/search (the GET variant 405s) —
// Meilisearch-style envelope, verified live 2026-06-10. `updated_at` is unix
// SECONDS (a number); the adapter converts it to ISO. `main_categories`
// replaces the older `categories` field (which now arrives null).
export const flathubSearch = {
  hits: [
    {
      app_id: "org.videolan.VLC",
      name: "VLC",
      summary: "VLC media player, the open-source multimedia player",
      icon: "https://dl.flathub.org/media/org/videolan/VLC/icons/128x128.png",
      developer_name: "VideoLAN",
      installs_last_month: 250_000,
      updated_at: 1748736000,
      main_categories: ["audiovideo"],
      project_license: "GPL-2.0-or-later",
    },
    {
      app_id: "com.obsproject.Studio",
      name: "OBS Studio",
      summary: "Free and open source software for video recording",
      developer_name: "OBS Project",
      installs_last_month: 180_000,
    },
  ],
  totalHits: 2,
};

export const aurSearch = {
  version: 5,
  type: "search",
  resultcount: 2,
  results: [
    {
      ID: 1193389,
      Name: "yay",
      Description: "Yet another yogurt. Pacman wrapper and AUR helper written in go.",
      NumVotes: 2_400,
      Maintainer: "jguer",
      LastModified: 1747600000,
      PackageBase: "yay",
      Popularity: 28.5,
      URL: "https://github.com/Jguer/yay",
      Version: "12.4.2-1",
    },
    {
      ID: 998877,
      Name: "paru",
      Description: "Feature packed AUR helper",
      NumVotes: 1_500,
      // Orphaned package — exercises the Maintainer fallback.
      Maintainer: null,
      LastModified: 1745000000,
      PackageBase: "paru",
      Popularity: 19.2,
      Version: "2.0.4-1",
    },
  ],
};

export const openvsxSearch = {
  offset: 0,
  totalSize: 2,
  extensions: [
    {
      namespace: "redhat",
      name: "java",
      displayName: "Language Support for Java(TM) by Red Hat",
      description: "Java Linting, Intellisense, formatting, refactoring...",
      url: "https://open-vsx.org/api/redhat/java",
      downloadCount: 4_000_000,
      categories: ["Programming Languages", "Linters"],
      timestamp: "2026-05-15T08:00:00.000Z",
      version: "1.40.0",
      license: "EPL-2.0",
    },
    {
      namespace: "vscodevim",
      name: "vim",
      displayName: "Vim",
      description: "Vim emulation for Visual Studio Code",
      downloadCount: 2_500_000,
      categories: ["Other"],
      timestamp: "2026-01-20T00:00:00.000Z",
    },
  ],
};

export const condaSearch = [
  {
    name: "numpy",
    owner: "conda-forge",
    full_name: "conda-forge/numpy",
    summary: "The fundamental package for scientific computing with Python.",
    home: "http://numpy.org/",
    html_url: "http://anaconda.org/conda-forge/numpy",
  },
  {
    name: "samtools",
    owner: "bioconda",
    full_name: "bioconda/samtools",
    summary: "Tools for dealing with SAM, BAM and CRAM files",
    html_url: "http://anaconda.org/bioconda/samtools",
  },
  {
    // Non-preferred channel — the adapter filters this one OUT.
    name: "numpy",
    owner: "anaconda",
    full_name: "anaconda/numpy",
    summary: "Array processing for numbers, strings, records, and objects.",
  },
];

export const nugetSearch = {
  totalHits: 2,
  data: [
    {
      id: "Newtonsoft.Json",
      version: "13.0.3",
      description: "Json.NET is a popular high-performance JSON framework for .NET",
      title: "Json.NET",
      iconUrl: "https://api.nuget.org/v3-flatcontainer/newtonsoft.json/13.0.3/icon",
      licenseUrl: "https://www.nuget.org/packages/Newtonsoft.Json/13.0.3/license",
      projectUrl: "https://www.newtonsoft.com/json",
      tags: ["json"],
      authors: ["James Newton-King"],
      totalDownloads: 4_000_000_000,
      verified: true,
    },
    {
      id: "Serilog",
      version: "4.2.0",
      description: "Simple .NET logging with fully-structured events",
      projectUrl: "https://serilog.net/",
      tags: ["serilog", "logging"],
      // Single string author — exercises the Array.isArray branch.
      authors: "Serilog Contributors",
      totalDownloads: 1_100_000_000,
      verified: true,
    },
  ],
};

export const zenodoSearch = {
  hits: {
    total: 2,
    hits: [
      {
        id: 3509134,
        doi: "10.5281/zenodo.3509134",
        doi_url: "https://doi.org/10.5281/zenodo.3509134",
        links: { self_html: "https://zenodo.org/records/3509134" },
        metadata: {
          title: "scikit-learn/scikit-learn: Scikit-learn 0.22",
          description: "<p>Machine learning in <b>Python</b>.</p>",
          keywords: ["machine learning", "python"],
          creators: [{ name: "Pedregosa, Fabian" }],
          license: { id: "BSD-3-Clause" },
          publication_date: "2019-12-03",
        },
        stats: { unique_views: 12_000, unique_downloads: 3_400, downloads: 5_000 },
        updated: "2024-01-10T00:00:00.000000+00:00",
        created: "2019-12-03T00:00:00.000000+00:00",
      },
      {
        id: 7777777,
        doi: "10.5281/zenodo.7777777",
        doi_url: "https://doi.org/10.5281/zenodo.7777777",
        links: { self_html: "https://zenodo.org/records/7777777" },
        metadata: {
          title: "A reproducible climate dataset",
          // No description / keywords / license — exercises fallbacks.
          creators: [],
          publication_date: "2023-03-28",
        },
        stats: { unique_views: 80, unique_downloads: 12, downloads: 20 },
        updated: "2023-03-29T00:00:00.000000+00:00",
        created: "2023-03-28T00:00:00.000000+00:00",
      },
    ],
  },
};

export const mavenSearch = {
  responseHeader: { status: 0 },
  response: {
    numFound: 2,
    start: 0,
    docs: [
      {
        id: "com.google.guava:guava",
        g: "com.google.guava",
        a: "guava",
        latestVersion: "33.4.0-jre",
        repositoryId: "central",
        p: "bundle",
        timestamp: 1734000000000,
        versionCount: 52,
      },
      {
        id: "org.apache.commons:commons-lang3",
        g: "org.apache.commons",
        a: "commons-lang3",
        latestVersion: "3.17.0",
        repositoryId: "central",
        p: "jar",
        timestamp: 1725000000000,
        versionCount: 30,
      },
    ],
  },
};

export const hexSearch = [
  {
    name: "phoenix",
    html_url: "https://hex.pm/packages/phoenix",
    docs_html_url: "https://hexdocs.pm/phoenix/",
    meta: {
      description: "Peace of mind from prototype to production",
      licenses: ["MIT"],
      links: {
        GitHub: "https://github.com/phoenixframework/phoenix",
        Changelog: "https://hexdocs.pm/phoenix/changelog.html",
      },
    },
    downloads: { all: 90_000_000, recent: 2_000_000, week: 450_000, day: 60_000 },
    inserted_at: "2014-04-21T22:38:32.000000Z",
    updated_at: "2026-05-06T07:30:27.416322Z",
    latest_stable_version: "1.8.7",
    latest_version: "1.8.7",
    repository: "hexpm",
  },
  {
    name: "ecto",
    html_url: "https://hex.pm/packages/ecto",
    meta: {
      description: "A toolkit for data mapping and language integrated query",
      licenses: ["Apache-2.0"],
      links: { GitHub: "https://github.com/elixir-ecto/ecto" },
    },
    downloads: { all: 80_000_000, recent: 1_800_000, week: 400_000 },
    inserted_at: "2014-05-03T00:00:00.000000Z",
    updated_at: "2026-04-01T00:00:00.000000Z",
    latest_stable_version: "3.12.5",
    latest_version: "3.12.5",
  },
];

export const wordpressSearch = {
  info: { page: 1, pages: 1, results: 2 },
  plugins: [
    {
      slug: "litespeed-cache",
      name: "LiteSpeed Cache &amp; Optimize",
      short_description:
        "All-in-one unbeatable acceleration &amp; PageSpeed improvement: caching, image/CSS optimization...",
      active_installs: 7_000_000,
      downloaded: 90_000_000,
      tags: { caching: "Caching", optimize: "Optimize", pagespeed: "PageSpeed" },
      author: '<a href="https://profiles.wordpress.org/litespeedtech/">LiteSpeed Technologies</a>',
      icons: {
        "1x": "https://ps.w.org/litespeed-cache/assets/icon-128x128.png?rev=2554181",
      },
      // 24h-clock variant — the adapter's parser must accept this alongside
      // the canonical 12h form in wordpressRealDateFormat below.
      last_updated: "2026-04-01 16:54 GMT",
    },
    {
      slug: "classic-editor",
      name: "Classic Editor",
      short_description: "Enables the previous “classic” editor...",
      active_installs: 10_000_000,
      downloaded: 60_000_000,
      tags: {},
      author: '<a href="https://wordpress.org/">WordPress Contributors</a>',
      icons: {},
      last_updated: null,
    },
  ],
};

// The live WordPress.org `last_updated` format, verified by curl 2026-06-10:
// "2026-04-01 4:54pm GMT" (12-hour clock, no zero-padding). The pre-fix
// adapter's replace()+toISOString() chain threw a RangeError on it, blanking
// the whole source — this fixture is the regression test for that bug.
export const wordpressRealDateFormat = {
  info: { page: 1, pages: 1, results: 1 },
  plugins: [
    {
      slug: "litespeed-cache",
      name: "LiteSpeed Cache",
      short_description: "All-in-one acceleration",
      active_installs: 7_000_000,
      last_updated: "2026-04-01 4:54pm GMT",
    },
  ],
};

// --- Community threads ---

export const hnSearch = {
  hits: [
    {
      objectID: "39000001",
      title: "Show HN: I built a metasearch for open source",
      url: "https://threadseeker.pages.dev",
      points: 512,
      num_comments: 240,
      author: "ryan_s",
      created_at: "2026-05-01T14:00:00Z",
      _tags: ["story", "show_hn"],
      story_text: null,
    },
    {
      objectID: "39000002",
      title: "Ask HN: Best self-hosted search engine?",
      // Text post: no url, story_text instead → adapter builds the item link.
      url: null,
      points: 130,
      num_comments: 95,
      author: "throwaway123",
      created_at: "2026-04-20T10:30:00Z",
      _tags: ["story", "ask_hn"],
      story_text: "<p>I want to index my own documents. What do people use?</p>",
    },
  ],
};

// Shape of https://lobste.rs/hottest.json (curl-verified 2026-06-10). The
// search.json endpoint is gone (HTTP 400 for every parameter combination),
// so the adapter degrades to this feed + client-side token filtering.
// `submitter_user` is now a plain username STRING; the second item keeps the
// legacy object form to exercise the adapter's both-shapes guard. The third
// item deliberately does NOT mention rust anywhere — the token filter must
// drop it for a "rust" query.
export const lobstersHottest = [
  {
    short_id: "abc123",
    short_id_url: "https://lobste.rs/s/abc123",
    title: "Writing a tiny Rust BM25 ranker from scratch",
    url: "https://example.dev/bm25",
    comments_url: "https://lobste.rs/s/abc123/writing_tiny_rust_bm25_ranker",
    score: 42,
    flags: 0,
    comment_count: 17,
    tags: ["programming", "search"],
    created_at: "2026-05-12T08:00:00.000-05:00",
    submitter_user: "alice",
    user_is_author: true,
    description: "",
    description_plain: "",
  },
  {
    short_id: "def456",
    title: "Forgejo 10 released",
    // Comments-only story: no external url. Tag carries the "rust" token.
    url: "",
    comments_url: "https://lobste.rs/s/def456/forgejo_10_released",
    score: 88,
    comment_count: 31,
    tags: ["release", "rust"],
    created_at: "2026-06-01T12:00:00.000-05:00",
    submitter_user: { username: "bob", avatar_url: "" },
    description: "<p>Changelog highlights…</p>",
    description_plain: "Changelog highlights…",
  },
  {
    short_id: "ghi789",
    title: "PostgreSQL vacuum internals",
    url: "https://example.dev/pg-vacuum",
    comments_url: "https://lobste.rs/s/ghi789/postgresql_vacuum_internals",
    score: 60,
    comment_count: 12,
    tags: ["databases"],
    created_at: "2026-06-05T09:00:00.000-05:00",
    submitter_user: "carol",
    description: "",
    description_plain: "",
  },
];

export const stackoverflowSearch = {
  has_more: false,
  quota_max: 300,
  quota_remaining: 297,
  items: [
    {
      question_id: 11227809,
      title: "Why is processing a sorted array faster than an unsorted array?",
      body: "<p>Here is a piece of C++ code that shows some very peculiar behavior...</p>",
      link: "https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster",
      score: 27_000,
      answer_count: 25,
      tags: ["java", "c++", "performance"],
      owner: {
        display_name: "GManNickG",
        profile_image: "https://i.sstatic.net/L8rHf.png",
      },
      last_activity_date: 1717264800,
      creation_date: 1340805096,
    },
    {
      question_id: 231767,
      title: "What does the &quot;yield&quot; keyword do in Python?",
      body: "<p>What functionality does the <code>yield</code> keyword provide?</p>",
      link: "https://stackoverflow.com/questions/231767/what-does-the-yield-keyword-do",
      score: 13_000,
      answer_count: 40,
      tags: ["python", "iterator"],
      // Deleted account — exercises the owner fallback.
      owner: null,
      last_activity_date: 1700000000,
      creation_date: 1224800000,
    },
  ],
};

export const devtoSearch = [
  {
    id: 2100001,
    title: "Rust for TypeScript developers",
    description: "A practical on-ramp to Rust if you live in TS all day.",
    url: "https://dev.to/alice/rust-for-typescript-developers-1a2b",
    slug: "rust-for-typescript-developers-1a2b",
    public_reactions_count: 310,
    positive_reactions_count: 305,
    comments_count: 24,
    tag_list: ["rust", "typescript", "beginners"],
    user: {
      name: "Alice Chen",
      username: "alice",
      profile_image_90: "https://media2.dev.to/dynamic/image/alice-90.png",
    },
    published_at: "2026-05-18T13:00:00Z",
    created_at: "2026-05-18T12:30:00Z",
  },
  {
    id: 2100002,
    title: "Why I rewrote my CLI in Rust",
    description: null,
    url: "https://dev.to/bob/why-i-rewrote-my-cli-in-rust-3c4d",
    slug: "why-i-rewrote-my-cli-in-rust-3c4d",
    public_reactions_count: 0,
    positive_reactions_count: 0,
    comments_count: 0,
    tag_list: ["rust", "cli"],
    // Missing user — exercises the author fallbacks.
    user: null,
    published_at: "2026-04-02T09:00:00Z",
    created_at: "2026-04-02T08:45:00Z",
  },
];

// --- Iter-25 additions (Modrinth / CRAN / AMO / Greasy Fork / Terraform /
// Snapcraft / Ansible Galaxy / GNOME Extensions / Chocolatey) — shapes
// curl-verified against the live APIs 2026-06-10. ---

export const modrinthSearch = {
  hits: [
    {
      project_id: "AANobbMI",
      project_type: "mod",
      slug: "sodium",
      author: "jellysquid3",
      title: "Sodium",
      description:
        "The fastest and most compatible rendering optimization mod for Minecraft.",
      categories: ["fabric", "neoforge", "optimization"],
      display_categories: ["fabric", "neoforge", "optimization"],
      downloads: 38_000_000,
      follows: 19_000,
      icon_url: "https://cdn.modrinth.com/data/AANobbMI/icon.png",
      date_created: "2021-01-03T00:53:34+00:00",
      date_modified: "2026-05-31T12:00:00+00:00",
      latest_version: "mc1.21.5-0.6.13",
      license: "LGPL-3.0-only",
    },
    {
      project_id: "gvQqBUqZ",
      project_type: "mod",
      slug: "lithium",
      author: "jellysquid3",
      title: "Lithium",
      description: "No-compromises game logic optimization mod.",
      categories: ["fabric", "optimization"],
      display_categories: ["fabric", "optimization"],
      downloads: 21_000_000,
      follows: 8_400,
      // Missing icon — exercises the avatar fallback.
      icon_url: null,
      date_created: "2021-01-03T01:10:00+00:00",
      date_modified: "2026-04-18T09:30:00+00:00",
      latest_version: "mc1.21.5-0.15.0",
      license: "LGPL-3.0-only",
    },
  ],
  total_hits: 2,
};

// Elasticsearch envelope from search.r-pkg.org (METACRAN).
export const cranSearch = {
  took: 12,
  hits: {
    total: 2,
    hits: [
      {
        _id: "ggplot2",
        _score: 11.2,
        _source: {
          Package: "ggplot2",
          Title: "Create Elegant Data Visualisations Using the Grammar of Graphics",
          Description:
            "A system for 'declaratively' creating graphics, based on \"The Grammar of Graphics\".",
          URL: "https://ggplot2.tidyverse.org, https://github.com/tidyverse/ggplot2",
          downloads: 2_400_000,
          revdeps: 5_900,
          License: "MIT + file LICENSE",
          Version: "3.5.2",
          date: "2025-04-09T07:30:02+00:00",
        },
      },
      {
        _id: "jsonlite",
        _score: 10.8,
        _source: {
          Package: "jsonlite",
          Title: "A Simple and Robust JSON Parser and Generator for R",
          Description: "A reasonably fast JSON parser and generator.",
          // No URL field — exercises the homepage fallback.
          downloads: 1_900_000,
          revdeps: 4_100,
          License: "MIT + file LICENSE",
          Version: "1.8.9",
          date: "2024-09-20T05:10:00+00:00",
        },
      },
    ],
  },
};

// AMO v5. `lang=en-US` is documented to flatten localized fields but live
// responses still carry {locale: value} objects — the first item keeps the
// object shape and the second uses plain strings, exercising BOTH branches
// of the adapter's amoLocalized() unwrap.
export const amoSearch = {
  page_size: 20,
  count: 2,
  results: [
    {
      id: 607454,
      slug: "ublock-origin",
      name: { "en-US": "uBlock Origin" },
      summary: {
        "en-US":
          "Finally, an efficient wide-spectrum content blocker. Easy on CPU and memory.",
      },
      url: "https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/",
      average_daily_users: 10_650_137,
      weekly_downloads: 155_912,
      ratings: { average: 4.8, count: 18_000 },
      categories: ["privacy-security"],
      authors: [{ id: 11423598, name: "Raymond Hill" }],
      icon_url: "https://addons.mozilla.org/user-media/addon_icons/607/607454-64.png",
      current_version: {
        version: "1.63.2",
        license: {
          slug: "GPL-3.0-only",
          name: { "en-US": "GNU General Public License v3.0 only" },
        },
      },
      last_updated: "2026-06-08T15:06:37Z",
      created: "2015-04-25T07:26:22Z",
    },
    {
      id: 865295,
      slug: "tree-style-tab",
      name: "Tree Style Tab",
      summary: "Show tabs like a tree.",
      url: "https://addons.mozilla.org/en-US/firefox/addon/tree-style-tab/",
      average_daily_users: 280_000,
      weekly_downloads: 4_100,
      ratings: { average: 4.6, count: 3_400 },
      categories: ["tabs"],
      // Missing author entry — exercises the fallback.
      authors: [],
      icon_url: "",
      current_version: { version: "4.0.16", license: null },
      last_updated: "2026-03-12T10:00:00Z",
      created: "2007-09-04T00:00:00Z",
    },
  ],
};

// Greasy Fork returns a bare array (no envelope, no page-size param).
export const greasyforkScripts = [
  {
    id: 4870,
    name: "YouTube Auto HD",
    description: "Automatically sets YouTube videos to your preferred quality.",
    url: "https://greasyfork.org/scripts/4870-youtube-auto-hd",
    total_installs: 1_250_000,
    daily_installs: 420,
    good_ratings: 980,
    license: "MIT",
    version: "3.2.1",
    code_updated_at: "2026-05-20T08:14:00.000Z",
    created_at: "2014-11-02T12:00:00.000Z",
    users: [{ id: 9100, name: "avi12", url: "https://greasyfork.org/users/9100-avi12" }],
  },
  {
    id: 38147,
    name: "YouTube Classic",
    description: null,
    url: "https://greasyfork.org/scripts/38147-youtube-classic",
    total_installs: 84_000,
    daily_installs: 12,
    good_ratings: 140,
    license: null,
    version: "1.9",
    code_updated_at: "2025-12-01T16:40:00.000Z",
    created_at: "2018-01-15T09:00:00.000Z",
    // Missing users — exercises the author fallback.
    users: [],
  },
];

export const terraformModules = {
  meta: { limit: 20, current_offset: 0 },
  modules: [
    {
      id: "terraform-aws-modules/vpc/aws/5.21.0",
      namespace: "terraform-aws-modules",
      name: "vpc",
      provider: "aws",
      version: "5.21.0",
      description: "Terraform module to create AWS VPC resources",
      source: "https://github.com/terraform-aws-modules/terraform-aws-vpc",
      published_at: "2025-04-02T13:42:05.528266Z",
      downloads: 87_000_000,
      verified: true,
    },
    {
      id: "terraform-aws-modules/eks/aws/20.36.0",
      namespace: "terraform-aws-modules",
      name: "eks",
      provider: "aws",
      version: "20.36.0",
      description: "Terraform module to create Amazon Elastic Kubernetes Service resources",
      source: "https://github.com/terraform-aws-modules/terraform-aws-eks",
      published_at: "2025-04-10T08:00:00Z",
      downloads: 42_000_000,
      verified: true,
    },
  ],
};

export const snapFind = {
  results: [
    {
      name: "vlc",
      revision: { version: "3.0.20-1" },
      snap: {
        title: "VLC",
        summary: "The ultimate media player",
        "store-url": "https://snapcraft.io/vlc",
        license: "GPL-2.0+",
        publisher: { "display-name": "VideoLAN", username: "videolan", validation: "verified" },
        media: [
          { type: "icon", url: "https://dashboard.snapcraft.io/site_media/appmedia/2016/07/vlc.png", width: 256, height: 256 },
          { type: "screenshot", url: "https://dashboard.snapcraft.io/site_media/appmedia/2016/07/vlc-shot.png", width: 1918, height: 1006 },
        ],
      },
    },
    {
      name: "gimp",
      revision: { version: "2.10.38" },
      snap: {
        title: "GIMP",
        summary: "GNU Image Manipulation Program",
        "store-url": "https://snapcraft.io/gimp",
        // No license / icon media — exercises the optional-field guards.
        publisher: { "display-name": "Snapcrafters", username: "snapcrafters" },
        media: [],
      },
    },
  ],
};

// Ansible Galaxy v3 collection-version search. Third item is deprecated and
// must be dropped by the adapter.
export const ansibleCollections = {
  meta: { count: 3 },
  data: [
    {
      collection_version: {
        namespace: "community",
        name: "docker",
        version: "4.5.2",
        description: "Modules and plugins for working with Docker.",
        pulp_created: "2025-04-07T12:03:10.248764Z",
        tags: ["docker", "container"],
      },
      is_highest: true,
      is_deprecated: false,
      is_signed: false,
    },
    {
      collection_version: {
        namespace: "ansible",
        name: "posix",
        version: "1.6.2",
        description: "Ansible Collection targeting POSIX and POSIX-ish platforms.",
        pulp_created: "2024-12-01T09:30:00Z",
        tags: ["posix", "system"],
      },
      is_highest: true,
      is_deprecated: false,
      is_signed: true,
    },
    {
      collection_version: {
        namespace: "community",
        name: "docker_legacy",
        version: "0.9.0",
        description: "Deprecated legacy Docker content.",
        pulp_created: "2021-02-01T00:00:00Z",
        tags: ["docker"],
      },
      is_highest: true,
      is_deprecated: true,
      is_signed: false,
    },
  ],
};

// extensions.gnome.org — `link` and `icon` are site-relative; `url` (when
// present) is the project's own homepage/repo.
export const gnomeExtensions = {
  extensions: [
    {
      uuid: "dash-to-dock@micxgx.gmail.com",
      name: "Dash to Dock",
      creator: "michele_g",
      pk: 307,
      description: "A dock for the Gnome Shell. This extension moves the dash out of the overview.",
      link: "/extension/307/dash-to-dock/",
      icon: "/extension-data/icons/icon_307.png",
      downloads: 9_200_000,
      url: "https://micheleg.github.io/dash-to-dock/",
    },
    {
      uuid: "blur-my-shell@aunetx",
      name: "Blur my Shell",
      creator: "aunetx",
      pk: 3193,
      description: "Adds a blur look to different parts of the GNOME Shell.",
      link: "/extension/3193/blur-my-shell/",
      // Default placeholder icon + no homepage url.
      icon: "/static/images/plugin.png",
      downloads: 4_800_000,
      url: "",
    },
  ],
  total: 2,
  numpages: 1,
};

// Chocolatey community feed — OData v2 Atom XML (string fixture; the adapter
// regex-walks <entry> blocks). DownloadCount carries the m:type attribute the
// real feed emits.
export const chocolateyAtom = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<feed xml:base="http://community.chocolatey.org/api/v2/" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Search</title>
  <entry>
    <id>http://community.chocolatey.org/api/v2/Packages(Id='git',Version='2.49.0')</id>
    <title type="text">git</title>
    <updated>2026-05-30T11:00:26Z</updated>
    <author><name>The Git Development Community</name></author>
    <m:properties>
      <d:Version>2.49.0</d:Version>
      <d:Title>Git</d:Title>
      <d:Description>Git is a free and open source distributed version control system designed to handle everything from small to very large projects.</d:Description>
      <d:GalleryDetailsUrl>https://community.chocolatey.org/packages/git/2.49.0</d:GalleryDetailsUrl>
      <d:DownloadCount m:type="Edm.Int32">14882190</d:DownloadCount>
      <d:Published m:type="Edm.DateTime">2026-03-18T20:14:36.55</d:Published>
    </m:properties>
  </entry>
  <entry>
    <id>http://community.chocolatey.org/api/v2/Packages(Id='7zip',Version='24.9.0')</id>
    <title type="text">7zip</title>
    <updated>2026-04-12T08:00:00Z</updated>
    <author><name>Igor Pavlov</name></author>
    <m:properties>
      <d:Version>24.9.0</d:Version>
      <d:Title>7-Zip</d:Title>
      <d:Description>7-Zip is a file archiver with a high compression ratio.</d:Description>
      <d:GalleryDetailsUrl>https://community.chocolatey.org/packages/7zip/24.9.0</d:GalleryDetailsUrl>
      <d:DownloadCount m:type="Edm.Int32">9120443</d:DownloadCount>
      <d:Published m:type="Edm.DateTime">2026-02-02T10:30:00</d:Published>
    </m:properties>
  </entry>
</feed>`;
