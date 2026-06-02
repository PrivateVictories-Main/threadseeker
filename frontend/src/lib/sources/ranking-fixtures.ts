// Deterministic ranking fixtures — small, realistic corpora for canonical
// concept queries, each with a known "ideal winner". These drive the offline
// ranking-quality gate (ranking-gate.test.ts): they run through the SAME
// mergeRelatedProjects + rankCorpus pipeline production uses, with NO network,
// so a ranking-weight change that tanks precision fails CI deterministically.
//
// The numbers are representative (real projects, plausible star orders), not
// live — the point is relative ordering ("the canonical pick should win"), which
// is exactly the owner promise: "finds EXACTLY the right project."
import type { UnifiedProject, SourceType } from "./types";

interface Seed {
  source?: SourceType;
  name: string;
  fullName: string;
  description: string;
  stars?: number;
  downloads?: number;
  language?: string;
  topics?: string[];
}

// A fixed recent timestamp so recency never skews these (all equally "fresh").
const RECENT = new Date(Date.now() - 10 * 86_400_000).toISOString();

function proj(s: Seed): UnifiedProject {
  return {
    id: `${s.source ?? "github"}-${s.fullName}`,
    source: s.source ?? "github",
    name: s.name,
    fullName: s.fullName,
    description: s.description,
    url: `https://github.com/${s.fullName}`,
    stars: s.stars ?? 0,
    downloads: s.downloads,
    language: s.language ?? null,
    topics: s.topics ?? [],
    updatedAt: RECENT,
    author: { name: s.fullName.split("/")[0], avatar: "" },
  };
}

export interface RankingCase {
  query: string;
  idealWinner: string; // fullName that should rank #1
  corpus: UnifiedProject[];
}

export const RANKING_CASES: RankingCase[] = [
  {
    query: "react state management",
    idealWinner: "pmndrs/zustand",
    corpus: [
      proj({ name: "zustand", fullName: "pmndrs/zustand", stars: 47000, description: "Bear necessities for state management in React", language: "TypeScript", topics: ["react", "state-management"] }),
      proj({ name: "redux", fullName: "reduxjs/redux", stars: 60000, description: "Predictable state container for JavaScript apps", language: "TypeScript", topics: ["state"] }),
      proj({ name: "react-query", fullName: "TanStack/query", stars: 41000, description: "Powerful asynchronous state management for data fetching", language: "TypeScript" }),
      proj({ name: "mobx", fullName: "mobxjs/mobx", stars: 27000, description: "Simple, scalable state management", language: "TypeScript" }),
      proj({ name: "awesome-react", fullName: "enaqx/awesome-react", stars: 64000, description: "A collection of awesome things regarding the React ecosystem", language: "Markdown" }),
    ],
  },
  {
    query: "python web framework",
    idealWinner: "tiangolo/fastapi",
    corpus: [
      proj({ name: "fastapi", fullName: "tiangolo/fastapi", stars: 76000, description: "FastAPI framework, high performance, easy to learn, fast to code, ready for production", language: "Python", topics: ["python", "web", "framework", "api"] }),
      proj({ name: "django", fullName: "django/django", stars: 79000, description: "The Web framework for perfectionists with deadlines", language: "Python", topics: ["python", "web"] }),
      proj({ name: "flask", fullName: "pallets/flask", stars: 67000, description: "The Python micro framework for building web applications", language: "Python", topics: ["python", "web"] }),
      proj({ name: "requests", fullName: "psf/requests", stars: 52000, description: "A simple, yet elegant, HTTP library for Python", language: "Python" }),
    ],
  },
  {
    query: "rust http framework",
    idealWinner: "tokio-rs/axum",
    corpus: [
      proj({ name: "axum", fullName: "tokio-rs/axum", stars: 18000, description: "Ergonomic and modular web framework built with Tokio, Tower, and Hyper", language: "Rust", topics: ["rust", "http", "web", "framework"] }),
      proj({ name: "actix-web", fullName: "actix/actix-web", stars: 21000, description: "Actix Web is a powerful, pragmatic, and extremely fast web framework for Rust", language: "Rust", topics: ["rust", "web"] }),
      proj({ name: "hyper", fullName: "hyperium/hyper", stars: 14000, description: "An HTTP library for Rust", language: "Rust", topics: ["rust", "http"] }),
      proj({ name: "tokio", fullName: "tokio-rs/tokio", stars: 26000, description: "A runtime for writing reliable asynchronous applications with Rust", language: "Rust" }),
    ],
  },
  {
    query: "vector database",
    idealWinner: "qdrant/qdrant",
    corpus: [
      proj({ name: "qdrant", fullName: "qdrant/qdrant", stars: 20000, description: "High-performance, massive-scale vector database and vector similarity search engine", language: "Rust", topics: ["vector-database", "search", "embeddings"] }),
      proj({ name: "milvus", fullName: "milvus-io/milvus", stars: 30000, description: "A cloud-native vector database, storage for next-generation AI applications", language: "Go", topics: ["vector-database"] }),
      proj({ name: "chroma", fullName: "chroma-core/chroma", stars: 14000, description: "the AI-native open-source embedding database", language: "Python", topics: ["embeddings"] }),
      proj({ name: "postgres", fullName: "postgres/postgres", stars: 16000, description: "Mirror of the official PostgreSQL relational database", language: "C" }),
    ],
  },
  {
    query: "local llm runtime",
    idealWinner: "ollama/ollama",
    corpus: [
      proj({ name: "ollama", fullName: "ollama/ollama", stars: 95000, description: "Get up and running with large language models locally", language: "Go", topics: ["llm", "local", "models", "runtime"] }),
      proj({ name: "llama.cpp", fullName: "ggerganov/llama.cpp", stars: 67000, description: "LLM inference in C/C++", language: "C++", topics: ["llm", "inference"] }),
      proj({ name: "vllm", fullName: "vllm-project/vllm", stars: 28000, description: "A high-throughput and memory-efficient inference and serving engine for LLMs", language: "Python", topics: ["llm", "serving"] }),
      proj({ name: "transformers", fullName: "huggingface/transformers", stars: 132000, description: "State-of-the-art Machine Learning for PyTorch, TensorFlow, and JAX", language: "Python" }),
    ],
  },
  {
    query: "css framework",
    idealWinner: "tailwindlabs/tailwindcss",
    corpus: [
      proj({ name: "tailwindcss", fullName: "tailwindlabs/tailwindcss", stars: 82000, description: "A utility-first CSS framework for rapid UI development", language: "TypeScript", topics: ["css", "framework", "ui"] }),
      proj({ name: "bootstrap", fullName: "twbs/bootstrap", stars: 169000, description: "The most popular HTML, CSS, and JavaScript framework for responsive sites", language: "JavaScript", topics: ["css", "framework"] }),
      proj({ name: "bulma", fullName: "jgthms/bulma", stars: 49000, description: "Modern CSS framework based on Flexbox", language: "CSS", topics: ["css", "framework"] }),
      proj({ name: "normalize.css", fullName: "necolas/normalize.css", stars: 50000, description: "A modern alternative to CSS resets", language: "CSS" }),
    ],
  },
  {
    query: "javascript bundler",
    idealWinner: "vitejs/vite",
    corpus: [
      proj({ name: "vite", fullName: "vitejs/vite", stars: 68000, description: "Next generation frontend tooling and build tool / bundler. It's fast!", language: "TypeScript", topics: ["bundler", "build-tool", "javascript"] }),
      proj({ name: "webpack", fullName: "webpack/webpack", stars: 64000, description: "A bundler for javascript and friends. Packs many modules into a few bundled assets", language: "JavaScript", topics: ["bundler", "javascript"] }),
      proj({ name: "esbuild", fullName: "evanw/esbuild", stars: 38000, description: "An extremely fast bundler for the web", language: "Go", topics: ["bundler"] }),
      proj({ name: "rollup", fullName: "rollup/rollup", stars: 25000, description: "Next-generation ES module bundler", language: "JavaScript", topics: ["bundler"] }),
    ],
  },
  {
    query: "typescript schema validation",
    idealWinner: "colinhacks/zod",
    corpus: [
      proj({ name: "zod", fullName: "colinhacks/zod", stars: 34000, description: "TypeScript-first schema validation with static type inference", language: "TypeScript", topics: ["typescript", "schema", "validation"] }),
      proj({ name: "yup", fullName: "jquense/yup", stars: 23000, description: "Dead simple Object schema validation", language: "TypeScript", topics: ["validation", "schema"] }),
      proj({ name: "joi", fullName: "hapijs/joi", stars: 21000, description: "The most powerful schema description language and data validator for JavaScript", language: "JavaScript", topics: ["validation"] }),
      proj({ name: "ajv", fullName: "ajv-validator/ajv", stars: 14000, description: "The fastest JSON schema Validator", language: "TypeScript" }),
    ],
  },
];
