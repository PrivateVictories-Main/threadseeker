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
];
