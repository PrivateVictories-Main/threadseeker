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
];

export interface ExpandQueryResult {
  /** Lowercased tokens — user's raw query words PLUS triggered expansions. */
  expandedTerms: string[];
  /** "owner/repo" fingerprints the ranker should boost. */
  boostFullNames: string[];
  /** Regex-based query intent for per-source weighting. */
  intent: Intent;
  /** Raw user query, lowercased & trimmed. */
  normalizedQuery: string;
}

export function expandQuery(raw: string): ExpandQueryResult {
  const q = raw.toLowerCase().trim();
  const userTokens = q.split(/\s+/).filter((t) => t.length > 1);

  const expanded = new Set<string>(userTokens);
  const boosts = new Set<string>();

  for (const entry of SYNONYMS) {
    const triggered = entry.triggers.some((t) => q.includes(t.toLowerCase()));
    if (!triggered) continue;
    if (entry.requires) {
      const allRequired = entry.requires.every((r) => q.includes(r.toLowerCase()));
      if (!allRequired) continue;
    }
    for (const e of entry.expandTo) expanded.add(e.toLowerCase());
    for (const b of entry.boostProjects ?? []) boosts.add(b.toLowerCase());
  }

  const { intent } = classifyIntent(raw);

  return {
    expandedTerms: Array.from(expanded),
    boostFullNames: Array.from(boosts),
    intent,
    normalizedQuery: q,
  };
}
