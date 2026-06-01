// frontend/src/lib/sources/synonyms.ts
import { classifyIntent, Intent } from "./intent";
// Hand-curated concept dictionary. Replaces the old LLM query-rewrite layer.
// Adding new "meta" terminology (e.g. when a framework blows up) = commit
// a new SynonymEntry. Zero runtime cost, fully version-controlled.

export interface SynonymEntry {
  /** Internal id, kebab-case. Used only for debugging/logs. */
  concept: string;
  /** Substrings in the raw query that activate this entry. Case-insensitive. */
  triggers: string[];
  /** If present, ALL of these must also appear in the query for activation. */
  requires?: string[];
  /** Terms OR-ed into fetch queries + weighted 0.5 in BM25 scoring. */
  expandTo: string[];
  /** "owner/repo" fingerprints that always get a ranking boost. */
  boostProjects?: string[];
}

export const SYNONYMS: SynonymEntry[] = [
  {
    concept: "react-state-management",
    triggers: ["state management", "state manager", "store", "global state"],
    requires: ["react"],
    expandTo: ["zustand", "jotai", "redux", "valtio", "mobx", "recoil", "signals"],
    boostProjects: ["pmndrs/zustand", "pmndrs/jotai", "reduxjs/redux"],
  },
  {
    concept: "vue-state-management",
    triggers: ["state management", "state manager", "store", "global state"],
    requires: ["vue"],
    expandTo: ["pinia", "vuex"],
    boostProjects: ["vuejs/pinia"],
  },
  {
    concept: "mcp-servers",
    triggers: ["mcp", "model context protocol", "tool calling", "ai tools"],
    expandTo: ["mcp", "model context protocol"],
    boostProjects: ["modelcontextprotocol/servers", "anthropics/mcp"],
  },
  {
    concept: "agentic-frameworks",
    triggers: ["agent framework", "agentic", "ai agent", "autonomous agent"],
    expandTo: ["langgraph", "langchain", "crewai", "autogen", "swarm"],
    boostProjects: ["langchain-ai/langgraph", "joaomdmoura/crewai"],
  },
  {
    concept: "vector-db",
    triggers: ["vector db", "vector database", "embeddings store"],
    expandTo: ["chroma", "qdrant", "weaviate", "milvus", "pgvector", "lancedb"],
    boostProjects: ["chroma-core/chroma", "qdrant/qdrant"],
  },
  {
    concept: "http-client",
    triggers: ["http client", "rest client", "api client"],
    expandTo: ["axios", "ky", "fetch", "got", "reqwest", "httpx", "requests"],
    boostProjects: ["axios/axios", "sindresorhus/ky", "psf/requests"],
  },
  {
    concept: "orm",
    triggers: ["orm", "object relational", "database orm"],
    expandTo: ["prisma", "drizzle", "sqlalchemy", "typeorm", "sequelize", "diesel"],
    boostProjects: ["prisma/prisma", "drizzle-team/drizzle-orm"],
  },
  {
    concept: "local-llm",
    triggers: ["local llm", "on device llm", "self hosted llm", "local model"],
    expandTo: ["ollama", "llamacpp", "lm studio", "vllm", "text generation inference"],
    boostProjects: ["ollama/ollama", "ggerganov/llama.cpp"],
  },
  {
    concept: "rust-async",
    triggers: ["async runtime", "async", "futures"],
    requires: ["rust"],
    expandTo: ["tokio", "async-std", "smol", "futures"],
    boostProjects: ["tokio-rs/tokio"],
  },
  {
    concept: "python-web-framework",
    triggers: ["web framework", "rest api", "http server"],
    requires: ["python"],
    expandTo: ["fastapi", "django", "flask", "starlette", "litestar"],
    boostProjects: ["tiangolo/fastapi", "django/django"],
  },

  // --- Testing ---
  {
    concept: "js-testing",
    triggers: ["testing", "test framework", "unit test"],
    requires: ["javascript"],
    expandTo: ["vitest", "jest", "mocha", "playwright", "cypress"],
    boostProjects: ["vitest-dev/vitest", "jestjs/jest"],
  },
  {
    concept: "python-testing",
    triggers: ["testing", "test framework", "unit test"],
    requires: ["python"],
    expandTo: ["pytest", "unittest", "hypothesis", "nose"],
    boostProjects: ["pytest-dev/pytest"],
  },
  {
    concept: "e2e-testing",
    triggers: ["e2e", "end to end", "browser testing"],
    expandTo: ["playwright", "cypress", "webdriverio", "puppeteer"],
    boostProjects: ["microsoft/playwright", "cypress-io/cypress"],
  },

  // --- Auth ---
  {
    concept: "auth",
    triggers: ["auth", "authentication", "login", "sso", "oauth"],
    expandTo: ["auth.js", "passport", "authlib", "clerk", "supabase auth", "keycloak"],
    boostProjects: ["nextauthjs/next-auth", "jaredhanson/passport"],
  },

  // --- Build tools ---
  {
    concept: "js-bundler",
    triggers: ["bundler", "build tool"],
    requires: ["javascript"],
    expandTo: ["vite", "turbopack", "esbuild", "webpack", "rollup", "parcel"],
    boostProjects: ["vitejs/vite", "evanw/esbuild"],
  },
  {
    concept: "monorepo",
    triggers: ["monorepo", "mono repo", "workspace"],
    expandTo: ["turborepo", "nx", "lerna", "rush", "pnpm workspace"],
    boostProjects: ["vercel/turborepo", "nrwl/nx"],
  },

  // --- Styling ---
  {
    concept: "css-framework",
    triggers: ["css framework", "styling framework", "utility css"],
    expandTo: ["tailwindcss", "bootstrap", "bulma", "open-props", "uno"],
    boostProjects: ["tailwindlabs/tailwindcss"],
  },
  {
    concept: "component-library",
    triggers: ["component library", "ui library", "design system"],
    requires: ["react"],
    expandTo: ["shadcn", "radix", "chakra", "mantine", "mui", "ark-ui"],
    boostProjects: ["shadcn-ui/ui", "radix-ui/primitives"],
  },

  // --- Deploy / hosting ---
  {
    concept: "static-host",
    triggers: ["static hosting", "deploy static", "jamstack"],
    expandTo: ["vercel", "netlify", "cloudflare pages", "github pages"],
  },
  {
    concept: "edge-runtime",
    triggers: ["edge runtime", "edge function", "edge compute"],
    expandTo: ["cloudflare workers", "deno deploy", "vercel edge", "fastly"],
    boostProjects: ["cloudflare/workers-sdk", "denoland/deno"],
  },
  {
    concept: "container-orchestration",
    triggers: ["orchestration", "kubernetes alt"],
    expandTo: ["kubernetes", "nomad", "docker swarm", "k3s"],
    boostProjects: ["kubernetes/kubernetes"],
  },

  // --- Databases ---
  {
    concept: "sql-database",
    triggers: ["sql database", "relational db", "rdbms"],
    expandTo: ["postgres", "postgresql", "mariadb", "sqlite", "duckdb", "mysql"],
    boostProjects: ["postgres/postgres", "duckdb/duckdb"],
  },
  {
    concept: "kv-store",
    triggers: ["key value store", "kv store", "cache"],
    expandTo: ["redis", "valkey", "dragonfly", "memcached", "keydb"],
    boostProjects: ["redis/redis", "valkey-io/valkey"],
  },
  {
    concept: "local-first-db",
    triggers: ["local first", "offline first db", "sync engine"],
    expandTo: ["rxdb", "powersync", "electric sql", "replicache", "automerge"],
    boostProjects: ["automerge/automerge"],
  },

  // --- Observability ---
  {
    concept: "llm-observability",
    triggers: ["llm observability", "llm ops", "prompt telemetry"],
    expandTo: ["langfuse", "helicone", "traceloop", "openllmetry"],
    boostProjects: ["langfuse/langfuse"],
  },
  {
    concept: "logging",
    triggers: ["logging", "log aggregation"],
    expandTo: ["loki", "vector", "fluentbit", "logstash"],
    boostProjects: ["grafana/loki"],
  },
  {
    concept: "metrics",
    triggers: ["metrics", "time series", "monitoring"],
    expandTo: ["prometheus", "influxdb", "victoriametrics", "grafana"],
    boostProjects: ["prometheus/prometheus", "grafana/grafana"],
  },

  // --- AI / ML tooling ---
  {
    concept: "image-generation",
    triggers: ["image generation", "text to image", "stable diffusion"],
    expandTo: ["stable diffusion", "comfyui", "automatic1111", "invokeai", "flux"],
    boostProjects: ["comfyanonymous/ComfyUI"],
  },
  {
    concept: "speech-to-text",
    triggers: ["speech to text", "transcription", "asr"],
    expandTo: ["whisper", "deepgram", "speechbrain"],
    boostProjects: ["openai/whisper"],
  },
  {
    concept: "embeddings",
    triggers: ["embeddings", "sentence embeddings", "text embeddings"],
    expandTo: ["sentence-transformers", "instructor", "bge", "nomic"],
    boostProjects: ["UKPLab/sentence-transformers"],
  },
  {
    concept: "rag",
    triggers: ["rag", "retrieval augmented"],
    expandTo: ["llamaindex", "langchain", "haystack", "ragas"],
    boostProjects: ["run-llama/llama_index", "langchain-ai/langchain"],
  },

  // --- Editor / IDE ---
  {
    concept: "code-editor",
    triggers: ["code editor", "ide"],
    expandTo: ["vscode", "neovim", "zed", "helix", "emacs"],
    boostProjects: ["zed-industries/zed", "neovim/neovim"],
  },
  {
    concept: "terminal-emulator",
    triggers: ["terminal", "terminal emulator", "shell"],
    expandTo: ["ghostty", "wezterm", "alacritty", "kitty", "warp"],
    boostProjects: ["ghostty-org/ghostty", "wez/wezterm"],
  },

  // --- Graphics / GPU ---
  {
    concept: "webgpu",
    triggers: ["webgpu", "gpu compute", "shader browser"],
    expandTo: ["wgpu", "webgpu", "three.js"],
    boostProjects: ["gfx-rs/wgpu"],
  },
  {
    concept: "3d-engine",
    triggers: ["3d engine", "3d in browser", "3d rendering"],
    expandTo: ["three.js", "babylon", "react-three-fiber"],
    boostProjects: ["mrdoob/three.js"],
  },

  // --- Markdown / Docs ---
  {
    concept: "rich-editor",
    triggers: ["rich text editor", "wysiwyg", "markdown editor"],
    expandTo: ["tiptap", "lexical", "slate", "prosemirror", "milkdown"],
    boostProjects: ["ueberdosis/tiptap"],
  },
  {
    concept: "static-site-generator",
    triggers: ["static site generator", "ssg"],
    expandTo: ["astro", "hugo", "zola", "eleventy", "jekyll"],
    boostProjects: ["withastro/astro", "gohugoio/hugo"],
  },

  // --- Queues / Messaging ---
  {
    concept: "message-queue",
    triggers: ["message queue", "pub sub", "event bus"],
    expandTo: ["rabbitmq", "nats", "kafka", "redpanda", "pulsar"],
    boostProjects: ["nats-io/nats-server", "redpanda-data/redpanda"],
  },

  // --- Security ---
  {
    concept: "password-manager",
    triggers: ["password manager", "secrets vault"],
    expandTo: ["bitwarden", "vaultwarden", "keepassxc", "1password"],
    boostProjects: ["dani-garcia/vaultwarden"],
  },

  // --- Workflow / Automation ---
  {
    concept: "workflow-automation",
    triggers: ["workflow automation", "no code automation"],
    expandTo: ["n8n", "make", "zapier alt", "windmill", "activepieces"],
    boostProjects: ["n8n-io/n8n", "windmill-labs/windmill"],
  },

  // --- Networking ---
  {
    concept: "reverse-proxy",
    triggers: ["reverse proxy"],
    expandTo: ["caddy", "traefik", "nginx", "haproxy"],
    boostProjects: ["caddyserver/caddy", "traefik/traefik"],
  },
  {
    concept: "tunnel",
    triggers: ["tunnel", "localhost tunnel", "expose localhost"],
    expandTo: ["ngrok", "cloudflared", "tailscale", "localtunnel"],
    boostProjects: ["cloudflare/cloudflared", "tailscale/tailscale"],
  },

  // --- CLI tooling ---
  {
    concept: "diff-tool",
    triggers: ["diff tool", "file diff"],
    expandTo: ["delta", "difftastic", "bat", "colordiff"],
    boostProjects: ["dandavison/delta", "Wilfred/difftastic"],
  },
  {
    concept: "grep-alt",
    triggers: ["grep alternative", "fast grep", "code search"],
    expandTo: ["ripgrep", "ag", "ack", "fd"],
    boostProjects: ["BurntSushi/ripgrep"],
  },
  {
    concept: "video-editor",
    triggers: ["video editor", "video editing"],
    expandTo: ["shotcut", "kdenlive", "davinci", "openshot", "olive"],
    boostProjects: ["mltframework/shotcut"],
  },

  // --- More state / UI niches ---
  {
    concept: "form-library",
    triggers: ["form library", "form validation"],
    requires: ["react"],
    expandTo: ["react-hook-form", "formik", "tanstack form", "conform"],
    boostProjects: ["react-hook-form/react-hook-form"],
  },
  {
    concept: "data-fetching",
    triggers: ["data fetching", "query cache", "swr"],
    requires: ["react"],
    expandTo: ["tanstack query", "swr", "rtk query", "relay"],
    boostProjects: ["TanStack/query", "vercel/swr"],
  },

  // --- Extra language ecosystems ---
  {
    concept: "go-web",
    triggers: ["web framework", "http server"],
    requires: ["go"],
    expandTo: ["gin", "echo", "fiber", "chi"],
    boostProjects: ["gin-gonic/gin"],
  },
  {
    concept: "java-web",
    triggers: ["web framework", "http server"],
    requires: ["java"],
    expandTo: ["spring boot", "quarkus", "micronaut", "javalin"],
    boostProjects: ["spring-projects/spring-boot"],
  },

  // ====================================================================
  // Iter-25 / Major Overhaul K — everyday-user vocabulary expansion.
  // Bridges the gap between "framework jargon" (above) and the practical
  // verbs/nouns people type when they're shopping for tools.
  // ====================================================================

  // --- Desktop input automation ---
  {
    concept: "automation-desktop",
    triggers: [
      "autoclicker",
      "auto clicker",
      "auto click",
      "mouse tapper",
      "mouse clicker",
      "click bot",
      "macro recorder",
      "key macro",
      "keybind",
      "automation desktop",
      "tapper",
    ],
    expandTo: [
      "autoclicker",
      "xdotool",
      "autohotkey",
      "hammerspoon",
      "keyboard maestro",
      "macro",
    ],
    boostProjects: [
      "jordansissel/xdotool",
      "Hammerspoon/hammerspoon",
      "AutoHotkey/AutoHotkey",
    ],
  },

  // --- Browser automation / scraping ---
  {
    concept: "browser-automation",
    triggers: [
      "browser automation",
      "headless browser",
      "scraping",
      "web scraper",
      "puppeteer alt",
      "selenium alt",
    ],
    expandTo: [
      "puppeteer",
      "playwright",
      "selenium",
      "webdriver",
      "scrapy",
      "beautifulsoup",
    ],
    boostProjects: ["puppeteer/puppeteer", "microsoft/playwright"],
  },

  // --- Screenshot / screen recording ---
  {
    concept: "screenshot-tool",
    triggers: [
      "screenshot",
      "screen capture",
      "screen recorder",
      "screencast",
      "screen record",
    ],
    expandTo: ["flameshot", "shotcut", "obs", "ffmpeg", "screenshot"],
    boostProjects: ["flameshot-org/flameshot", "obsproject/obs-studio"],
  },

  // --- Clipboard manager ---
  {
    concept: "clipboard-manager",
    triggers: [
      "clipboard manager",
      "clipboard history",
      "clip manager",
      "copy paste history",
    ],
    expandTo: ["maccy", "ditto", "copyq", "flycut", "clipboard"],
    boostProjects: ["p0deje/Maccy", "hluk/CopyQ"],
  },

  // --- File / folder sync ---
  {
    concept: "file-sync",
    triggers: [
      "file sync",
      "folder sync",
      "rsync alternative",
      "syncthing alt",
      "file synchronization",
    ],
    expandTo: ["syncthing", "rsync", "rclone", "unison"],
    boostProjects: ["syncthing/syncthing", "rclone/rclone"],
  },

  // --- Media player ---
  {
    concept: "media-player",
    triggers: [
      "media player",
      "video player",
      "audio player",
      "music player",
      "mp4 player",
    ],
    expandTo: ["vlc", "mpv", "iina", "kodi", "plex"],
    boostProjects: ["videolan/vlc", "mpv-player/mpv"],
  },

  // --- Torrent client ---
  {
    concept: "torrent-client",
    triggers: ["torrent client", "bittorrent client", "torrent app"],
    expandTo: ["qbittorrent", "transmission", "rtorrent", "deluge"],
    boostProjects: ["qbittorrent/qBittorrent"],
  },

  // --- RSS reader ---
  {
    concept: "rss-reader",
    triggers: [
      "rss reader",
      "rss feed reader",
      "newsreader",
      "feed reader",
      "rss app",
    ],
    expandTo: [
      "feedbin",
      "feedly alt",
      "newsboat",
      "miniflux",
      "freshrss",
    ],
    boostProjects: ["miniflux/v2"],
  },

  // --- Note taking / PKM ---
  {
    concept: "note-taking",
    triggers: [
      "note taking",
      "notes app",
      "obsidian alt",
      "notion alt",
      "markdown notes",
      "pkm",
      "second brain",
    ],
    expandTo: [
      "obsidian",
      "logseq",
      "joplin",
      "standard notes",
      "anytype",
      "trilium",
    ],
    boostProjects: ["logseq/logseq", "laurent22/joplin"],
  },

  // --- Tasks / kanban / issue tracking ---
  {
    concept: "task-tracker",
    triggers: [
      "todo app",
      "task tracker",
      "kanban",
      "issue tracker self hosted",
      "todo list",
      "task manager",
    ],
    expandTo: ["todoist alt", "taskwarrior", "wekan", "kanboard", "vikunja"],
    boostProjects: ["taskwarrior/taskwarrior", "wekan/wekan"],
  },

  // --- Self-hosted catch-all ---
  {
    concept: "self-hosted-tools",
    triggers: [
      "self hosted",
      "self-hosted",
      "selfhosted",
      "open source alternative",
      "homelab",
    ],
    expandTo: ["selfhosted", "awesome selfhosted"],
    boostProjects: ["awesome-selfhosted/awesome-selfhosted"],
  },

  // --- CLI tool catch-all ---
  {
    concept: "cli-tool",
    triggers: [
      "cli tool",
      "command line tool",
      "terminal app",
      "terminal tool",
      "shell utility",
    ],
    expandTo: ["bat", "fzf", "ripgrep", "tldr", "fd", "zoxide", "exa"],
    boostProjects: ["sharkdp/bat", "junegunn/fzf"],
  },

  // --- Dotfile / config manager ---
  {
    concept: "dotfile-manager",
    triggers: [
      "dotfile",
      "dotfiles manager",
      "config manager",
      "dotfiles sync",
    ],
    expandTo: ["chezmoi", "yadm", "stow", "dotbot"],
    boostProjects: ["twpayne/chezmoi", "TheLocehiliosan/yadm"],
  },

  // --- AI coding / Copilot alternatives ---
  {
    concept: "ai-coding",
    triggers: [
      "copilot alt",
      "ai coding",
      "ai code completion",
      "autocomplete code",
      "code completion",
    ],
    expandTo: ["continue", "cody", "codeium", "tabby", "supermaven"],
    boostProjects: ["continuedev/continue"],
  },

  // --- Personal finance / budgeting ---
  {
    concept: "personal-finance",
    triggers: [
      "personal finance",
      "budgeting",
      "expense tracker",
      "money manager",
      "ynab alt",
      "mint alt",
    ],
    expandTo: ["actual budget", "firefly iii", "ynab alt", "ledger"],
    boostProjects: ["actualbudget/actual", "firefly-iii/firefly-iii"],
  },

  // --- Music streaming / library ---
  {
    concept: "music-streaming",
    triggers: [
      "music streaming",
      "spotify alt",
      "self hosted music",
      "music server",
      "music library",
    ],
    expandTo: ["navidrome", "jellyfin", "plex", "funkwhale"],
    boostProjects: ["navidrome/navidrome", "jellyfin/jellyfin"],
  },

  // --- Photo library / management ---
  {
    concept: "photo-library",
    triggers: [
      "photo library",
      "photo manager",
      "google photos alt",
      "photo gallery",
      "photo backup",
    ],
    expandTo: ["immich", "photoprism", "librephotos", "piwigo"],
    boostProjects: ["immich-app/immich", "photoprism/photoprism"],
  },

  // --- Email client ---
  {
    concept: "email-client",
    triggers: [
      "email client",
      "mail client",
      "mail app",
      "gmail alt",
      "imap client",
    ],
    expandTo: ["thunderbird", "mailspring", "geary", "alpine", "neomutt"],
    boostProjects: ["mailspring/mailspring"],
  },

  // --- Chat / messaging ---
  {
    concept: "chat-messenger",
    triggers: [
      "chat app",
      "messenger app",
      "discord alt",
      "slack alt",
      "matrix client",
      "team chat",
    ],
    expandTo: ["element", "matrix", "rocketchat", "mattermost", "zulip"],
    boostProjects: [
      "element-hq/element-web",
      "RocketChat/Rocket.Chat",
      "mattermost/mattermost",
    ],
  },

  // --- Video conferencing ---
  {
    concept: "video-conferencing",
    triggers: [
      "video conferencing",
      "zoom alt",
      "video call",
      "video chat",
      "webrtc app",
    ],
    expandTo: ["jitsi", "bigbluebutton", "nextcloud talk"],
    boostProjects: ["jitsi/jitsi-meet"],
  },

  // --- Calendar / scheduling ---
  {
    concept: "calendar-app",
    triggers: [
      "calendar app",
      "scheduling app",
      "calendly alt",
      "caldav",
      "calendar server",
    ],
    expandTo: ["cal.com", "radicale", "baikal", "etesync", "easyappointments"],
    boostProjects: ["calcom/cal.com"],
  },

  // --- Diagram / drawing ---
  {
    concept: "diagram-tool",
    triggers: [
      "diagram tool",
      "drawing app",
      "whiteboard",
      "flowchart",
      "draw.io alt",
      "miro alt",
      "excalidraw",
    ],
    expandTo: ["excalidraw", "drawio", "tldraw", "mermaid"],
    boostProjects: ["excalidraw/excalidraw", "tldraw/tldraw"],
  },

  // --- Image editing ---
  {
    concept: "image-editor",
    triggers: [
      "image editor",
      "photo editor",
      "photoshop alt",
      "raster editor",
      "image manipulation",
    ],
    expandTo: ["gimp", "krita", "photopea", "darktable"],
    boostProjects: ["GNOME/gimp"],
  },

  // --- 3D / modeling ---
  {
    concept: "3d-modeling",
    triggers: ["3d modeling", "blender alt", "cad", "3d sculpting"],
    expandTo: ["blender", "openscad", "freecad"],
    boostProjects: ["blender/blender"],
  },

  // --- Game engine ---
  {
    concept: "game-engine",
    triggers: ["game engine", "godot alt", "unity alt", "2d game engine"],
    expandTo: ["godot", "bevy", "love2d", "phaser"],
    boostProjects: ["godotengine/godot", "bevyengine/bevy"],
  },

  // --- Bookmark manager / read later ---
  {
    concept: "bookmark-manager",
    triggers: [
      "bookmark manager",
      "read later",
      "pocket alt",
      "bookmark app",
      "linkding",
    ],
    expandTo: ["linkding", "wallabag", "shiori", "raindrop"],
    boostProjects: ["sissbruecker/linkding", "wallabag/wallabag"],
  },

  // --- Habit tracking ---
  {
    concept: "habit-tracker",
    triggers: ["habit tracker", "habit app", "streak tracker"],
    expandTo: ["loop habit tracker", "habitica"],
    boostProjects: ["iSoron/uhabits", "HabitRPG/habitica"],
  },

  // --- VPN / privacy ---
  {
    concept: "vpn-self-hosted",
    triggers: [
      "self hosted vpn",
      "wireguard ui",
      "vpn server",
      "vpn alt",
      "openvpn alt",
    ],
    expandTo: ["wireguard", "tailscale", "headscale", "openvpn"],
    boostProjects: ["WireGuard/wireguard-tools", "juanfont/headscale"],
  },

  // --- Backup ---
  {
    concept: "backup-tool",
    triggers: [
      "backup tool",
      "backup software",
      "incremental backup",
      "encrypted backup",
    ],
    expandTo: ["restic", "borgbackup", "duplicati", "kopia"],
    boostProjects: ["restic/restic", "borgbackup/borg"],
  },
];

export interface ExpandQueryResult {
  /** Lowercased tokens — user's raw query words PLUS triggered expansions. */
  expandedTerms: string[];
  /** Only the triggered synonym expansions (canonical project/lib names),
   *  WITHOUT the user's own query tokens. Used to build focused OR-queries for
   *  OR-supporting sources without dragging in paragraph filler words. */
  synonymTerms: string[];
  /** "owner/repo" fingerprints the ranker should boost. */
  boostFullNames: string[];
  /** Regex-based query intent for per-source weighting. */
  intent: Intent;
  /** Raw user query, lowercased & trimmed. */
  normalizedQuery: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// True when `needle` matches the query as a whole word/token rather than an
// arbitrary substring. The old `q.includes(needle)` fired "orm" on "platform",
// "rag" on "storage", and "go" on "google" — polluting expansion + boosts.
//   - multi-word phrase ("state management") → word-boundary match in q
//   - single token ("orm", "go")            → exact token (naive plural-tolerant)
function matchesQuery(needle: string, q: string, tokenSet: Set<string>): boolean {
  const t = needle.toLowerCase().trim();
  if (!t) return false;
  if (t.includes(" ")) {
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(t)}(?:[^a-z0-9]|$)`).test(q);
  }
  return (
    tokenSet.has(t) ||
    tokenSet.has(`${t}s`) ||
    (t.endsWith("s") && tokenSet.has(t.slice(0, -1)))
  );
}

export function expandQuery(raw: string): ExpandQueryResult {
  const q = raw.toLowerCase().trim();
  const userTokens = q.split(/\s+/).filter((t) => t.length > 1);
  const tokenSet = new Set(userTokens);

  const expanded = new Set<string>(userTokens);
  const synonymsAdded = new Set<string>();
  const boosts = new Set<string>();

  for (const entry of SYNONYMS) {
    const triggered = entry.triggers.some((t) => matchesQuery(t, q, tokenSet));
    if (!triggered) continue;
    if (entry.requires) {
      const allRequired = entry.requires.every((r) => matchesQuery(r, q, tokenSet));
      if (!allRequired) continue;
    }
    for (const e of entry.expandTo) {
      const lc = e.toLowerCase();
      expanded.add(lc);
      if (!tokenSet.has(lc)) synonymsAdded.add(lc);
    }
    for (const b of entry.boostProjects ?? []) boosts.add(b.toLowerCase());
  }

  const { intent } = classifyIntent(raw);

  return {
    expandedTerms: Array.from(expanded),
    synonymTerms: Array.from(synonymsAdded),
    boostFullNames: Array.from(boosts),
    intent,
    normalizedQuery: q,
  };
}
