// Canonical query set for search-quality evaluation.
//
// Each entry captures a real-world search intent and the results we'd be
// embarrassed to miss. The expectation is DIRECTIONAL, not exhaustive:
// "if you search X, at least one of these should be in the top 3." That
// gives us precision@3 and MRR over a broad cross-section of query shapes
// without pretending we can enumerate every reasonable answer.
//
// Guidelines for adding queries:
//   - Expected values are matched case-insensitive against `name` and
//     `fullName` as substrings, so `"next.js"` matches `vercel/next.js`.
//   - Prefer 2-3 canonical expectations per query. One is brittle; five
//     turns the test into a sieve that accepts anything.
//   - Mix shapes: single-word, multi-word, scoped ("python http client"),
//     ambiguous ("auth"), package-name-only ("react"), and task-shaped
//     ("how to parse csv in rust").

export type QueryCategory =
  | "exact-name"
  | "broad-concept"
  | "language-scoped"
  | "task-shaped"
  | "ambiguous"
  | "ecosystem";

export interface BacktestQuery {
  query: string;
  category: QueryCategory;
  // Any one of these in the top N counts as a hit. Matched case-insensitive
  // as a substring against `name` or `fullName`.
  expected: string[];
  // Optional: the ideal winner — populated for queries where there is one
  // obviously correct answer. Used for a separate "exact-winner" score.
  idealWinner?: string;
}

export const BACKTEST_QUERIES: BacktestQuery[] = [
  // --- Exact-name: the user knows what they're looking for ---
  { query: "react", category: "exact-name", expected: ["react", "facebook/react"], idealWinner: "facebook/react" },
  { query: "next.js", category: "exact-name", expected: ["next.js", "vercel/next.js", "next"], idealWinner: "vercel/next.js" },
  { query: "fastapi", category: "exact-name", expected: ["fastapi", "tiangolo/fastapi"], idealWinner: "tiangolo/fastapi" },
  { query: "axios", category: "exact-name", expected: ["axios"], idealWinner: "axios" },
  { query: "tailwindcss", category: "exact-name", expected: ["tailwindcss", "tailwindlabs/tailwindcss"], idealWinner: "tailwindlabs/tailwindcss" },
  { query: "jackson-core", category: "exact-name", expected: ["jackson-core"] },
  { query: "llama.cpp", category: "exact-name", expected: ["llama.cpp", "ggerganov/llama.cpp"] },
  { query: "pytorch", category: "exact-name", expected: ["pytorch", "torch"] },
  { query: "kubernetes", category: "exact-name", expected: ["kubernetes"] },
  { query: "pandas", category: "exact-name", expected: ["pandas"] },

  // --- Broad concept: user describes a category ---
  { query: "http client", category: "broad-concept", expected: ["axios", "requests", "httpx", "reqwest", "got", "fetch"] },
  { query: "orm", category: "broad-concept", expected: ["prisma", "sqlalchemy", "typeorm", "drizzle", "diesel", "sequelize"] },
  { query: "authentication", category: "broad-concept", expected: ["auth", "passport", "nextauth", "authjs", "authlib", "oauth"] },
  { query: "state management", category: "broad-concept", expected: ["redux", "zustand", "jotai", "mobx", "pinia", "recoil"] },
  { query: "testing framework", category: "broad-concept", expected: ["jest", "vitest", "pytest", "mocha", "cypress", "playwright"] },
  { query: "vector database", category: "broad-concept", expected: ["chroma", "qdrant", "pinecone", "weaviate", "milvus", "pgvector"] },

  // --- Language-scoped: explicit ecosystem ---
  { query: "python web framework", category: "language-scoped", expected: ["django", "flask", "fastapi", "starlette", "tornado"] },
  { query: "rust async runtime", category: "language-scoped", expected: ["tokio", "async-std", "smol"] },
  { query: "go web framework", category: "language-scoped", expected: ["gin", "echo", "fiber", "chi", "gorilla"] },
  { query: "java http client", category: "language-scoped", expected: ["okhttp", "retrofit", "apache-httpclient", "httpclient"] },
  { query: "kotlin coroutines", category: "language-scoped", expected: ["kotlinx.coroutines", "coroutines"] },

  // --- Task-shaped: natural-language intent ---
  { query: "parse csv", category: "task-shaped", expected: ["csv", "papaparse", "csv-parser", "pandas"] },
  { query: "generate pdf", category: "task-shaped", expected: ["pdf", "puppeteer", "reportlab", "pdfkit", "jspdf", "wkhtmltopdf"] },
  { query: "send email", category: "task-shaped", expected: ["nodemailer", "sendmail", "mail", "resend", "postmark", "sendgrid"] },
  { query: "image compression", category: "task-shaped", expected: ["sharp", "pillow", "imagemin", "squoosh", "mozjpeg"] },

  // --- Ambiguous: multiple reasonable interpretations ---
  { query: "auth", category: "ambiguous", expected: ["auth", "authjs", "nextauth", "passport", "authlib", "oauth"] },
  { query: "ai", category: "ambiguous", expected: ["openai", "langchain", "llama", "transformers", "ollama"] },
  { query: "cache", category: "ambiguous", expected: ["redis", "memcached", "cache", "lru-cache", "node-cache"] },

  // --- Ecosystem: "best in X" ---
  { query: "react components library", category: "ecosystem", expected: ["shadcn", "radix", "chakra", "mantine", "mui", "antd"] },
  { query: "llm inference", category: "ecosystem", expected: ["llama.cpp", "vllm", "ollama", "transformers", "llamafile"] },

  // --- Newer-meta / 2025-2026 ---
  { query: "mcp server", category: "broad-concept", expected: ["mcp", "model-context-protocol", "modelcontextprotocol/servers"] },
  { query: "mcp server for postgres", category: "task-shaped", expected: ["mcp", "postgres"] },
  { query: "agentic framework", category: "broad-concept", expected: ["langgraph", "crewai", "autogen", "swarm"] },
  { query: "ai agent framework python", category: "language-scoped", expected: ["langgraph", "crewai", "autogen"] },
  { query: "local llm runtime", category: "broad-concept", expected: ["ollama", "llama.cpp", "vllm", "lm-studio"] },
  { query: "llm observability", category: "broad-concept", expected: ["langfuse", "helicone", "traceloop"] },
  { query: "vector database self hosted", category: "task-shaped", expected: ["chroma", "qdrant", "weaviate", "milvus"] },
  { query: "text to image open source", category: "task-shaped", expected: ["stable-diffusion", "comfyui", "flux"] },
  { query: "whisper transcription", category: "exact-name", expected: ["whisper", "openai/whisper"] },
  { query: "rag pipeline", category: "broad-concept", expected: ["llamaindex", "langchain", "haystack"] },

  // --- Dev tooling ---
  { query: "ripgrep", category: "exact-name", expected: ["ripgrep"], idealWinner: "BurntSushi/ripgrep" },
  { query: "diff tool cli", category: "task-shaped", expected: ["delta", "difftastic"] },
  { query: "code editor rust", category: "language-scoped", expected: ["zed", "helix"] },
  { query: "terminal emulator gpu", category: "broad-concept", expected: ["ghostty", "wezterm", "alacritty", "kitty"] },
  { query: "js bundler fast", category: "broad-concept", expected: ["vite", "turbopack", "esbuild", "rolldown"] },
  { query: "monorepo tool", category: "broad-concept", expected: ["turborepo", "nx", "lerna"] },

  // --- Framework ecosystems ---
  { query: "react form library", category: "language-scoped", expected: ["react-hook-form", "formik", "tanstack-form"] },
  { query: "react data fetching", category: "language-scoped", expected: ["tanstack-query", "react-query", "swr"] },
  { query: "vue state management", category: "language-scoped", expected: ["pinia", "vuex"] },
  { query: "svelte component library", category: "language-scoped", expected: ["melt", "bits-ui", "skeleton"] },
  { query: "react component library", category: "language-scoped", expected: ["shadcn", "radix", "chakra", "mui"] },

  // --- Data / DB ---
  { query: "postgres orm javascript", category: "language-scoped", expected: ["prisma", "drizzle", "typeorm", "kysely"] },
  { query: "local first sync engine", category: "task-shaped", expected: ["automerge", "powersync", "replicache", "electric"] },
  { query: "duckdb", category: "exact-name", expected: ["duckdb"], idealWinner: "duckdb/duckdb" },
  { query: "valkey", category: "exact-name", expected: ["valkey"], idealWinner: "valkey-io/valkey" },

  // --- Infra ---
  { query: "reverse proxy", category: "broad-concept", expected: ["caddy", "traefik", "nginx"] },
  { query: "tunnel localhost", category: "task-shaped", expected: ["cloudflared", "ngrok", "tailscale"] },
  { query: "kubernetes alternative", category: "broad-concept", expected: ["nomad", "k3s", "docker-swarm"] },
  { query: "edge runtime", category: "broad-concept", expected: ["cloudflare-workers", "deno-deploy", "fastly"] },

  // --- Security ---
  { query: "password manager self hosted", category: "task-shaped", expected: ["bitwarden", "vaultwarden", "keepassxc"] },

  // --- Graphics ---
  { query: "3d in browser", category: "task-shaped", expected: ["three.js", "babylon", "react-three-fiber"] },
  { query: "shader playground", category: "task-shaped", expected: ["shadertoy", "twgl", "regl"] },
  { query: "webgpu library", category: "broad-concept", expected: ["wgpu", "three.js", "babylon"] },

  // --- Go / Java / Scala ---
  { query: "go web framework", category: "language-scoped", expected: ["gin", "echo", "fiber", "chi"] },
  { query: "java web framework", category: "language-scoped", expected: ["spring-boot", "quarkus", "micronaut"] },

  // --- Workflow / automation ---
  { query: "n8n", category: "exact-name", expected: ["n8n"], idealWinner: "n8n-io/n8n" },
  { query: "workflow automation self hosted", category: "task-shaped", expected: ["n8n", "windmill", "activepieces"] },

  // --- Newer editors ---
  { query: "zed editor", category: "exact-name", expected: ["zed"], idealWinner: "zed-industries/zed" },
  { query: "helix editor", category: "exact-name", expected: ["helix"], idealWinner: "helix-editor/helix" },

  // --- Media / video ---
  { query: "video editor open source", category: "task-shaped", expected: ["shotcut", "kdenlive", "openshot", "olive"] },

  // --- Markdown / editors ---
  { query: "rich text editor javascript", category: "language-scoped", expected: ["tiptap", "lexical", "slate", "prosemirror"] },
  { query: "markdown wysiwyg", category: "task-shaped", expected: ["tiptap", "milkdown", "lexical"] },

  // --- Observability ---
  { query: "metrics time series db", category: "task-shaped", expected: ["prometheus", "influxdb", "victoriametrics"] },
  { query: "log aggregation", category: "broad-concept", expected: ["loki", "vector", "fluentbit"] },

  // --- Static site ---
  { query: "static site generator", category: "broad-concept", expected: ["astro", "hugo", "zola", "eleventy"] },

  // --- Niche but canonical ---
  { query: "ollama", category: "exact-name", expected: ["ollama"], idealWinner: "ollama/ollama" },
  { query: "comfyui", category: "exact-name", expected: ["comfyui"], idealWinner: "comfyanonymous/comfyui" },
  { query: "langgraph", category: "exact-name", expected: ["langgraph"], idealWinner: "langchain-ai/langgraph" },
  { query: "tiptap", category: "exact-name", expected: ["tiptap"], idealWinner: "ueberdosis/tiptap" },
  { query: "shadcn ui", category: "exact-name", expected: ["shadcn", "shadcn-ui/ui"], idealWinner: "shadcn-ui/ui" },
];
