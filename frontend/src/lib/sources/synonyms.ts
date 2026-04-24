// frontend/src/lib/sources/synonyms.ts
// Hand-curated concept dictionary. Replaces the Groq query-rewrite layer.
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
];
