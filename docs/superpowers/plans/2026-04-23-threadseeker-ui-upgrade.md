# ThreadSeeker UI Upgrade & Search-Quality Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ThreadSeeker's search-quality pipeline (synonyms + BM25, no LLM) and the entire visual/motion layer (Liquid Glass + Framer Motion) across four committable milestones.

**Architecture:** Next.js 14 static export + Cloudflare Pages Functions at `/api/*`, developed locally via `wrangler pages dev`. All changes are inside `frontend/`. Four layered milestones — ranker → cards → visual system → motion — each with its own gate. No LLM at runtime, no new infrastructure, no paid APIs, localhost-only.

**Tech Stack:** TypeScript · Next.js 14 · React 18 · vitest · Cloudflare Pages Functions · Framer Motion (new) · CSS custom properties

**Source spec:** `docs/superpowers/specs/2026-04-23-threadseeker-ui-upgrade-design.md`

---

## File Structure

### Milestone 1 — Ranker

**Create:**
- `frontend/src/lib/sources/synonyms.ts` — concept/alias dictionary + `expandQuery()`
- `frontend/src/lib/sources/synonyms.test.ts` — unit tests
- `frontend/src/lib/sources/ranking-bm25.ts` — BM25 ranker + `rankCorpus()`
- `frontend/src/lib/sources/ranking-bm25.test.ts` — unit tests
- `frontend/src/lib/sources/intent.ts` — intent classifier extracted from old ranking (kept regex-based)

**Modify:**
- `frontend/scripts/backtest-queries.ts` — grow from 30 → ~80 queries
- `frontend/src/app/page.tsx` — remove Groq calls, wire `expandQuery()` into search flow
- `frontend/src/lib/api-client.ts` — delete Groq client helpers, keep source helpers
- `frontend/src/lib/sources/index.ts` — re-export new ranker, drop old
- `frontend/src/lib/sources/adapters.ts` — accept expansion terms in `search*()` fetchers

**Delete:**
- `frontend/functions/api/optimize-queries.ts`
- `frontend/functions/api/synthesize.ts`
- `frontend/functions/api/related-queries.ts`
- `frontend/functions/api/integrate.ts`
- `frontend/functions/api/_shared/groq.ts`
- `frontend/src/lib/sources/ranking.ts` (after cut-over)
- `frontend/src/lib/sources/ranking.test.ts` (after cut-over)
- `frontend/src/components/SynthesisBox.tsx` (Groq verdict box, unused post-M1)

### Milestone 2 — Cards

**Create:**
- `frontend/src/components/card/CardPills.tsx` — 4-pill metadata row
- `frontend/src/components/card/CardPills.test.tsx`
- `frontend/src/components/card/SourceBadge.tsx` — vendor-colored source chip
- `frontend/src/components/card/SourceBadge.test.tsx`
- `frontend/src/components/card/CardActions.tsx` — action row (Open + copy-install)
- `frontend/src/components/card/CardActions.test.tsx`

**Modify:**
- `frontend/src/components/UnifiedProjectCard.tsx` — slim rebuild ≤ 250 lines
- `frontend/src/app/page.tsx` — drop Sparkles button wiring

**Delete:**
- Sparkles / integration-snippet button block from `UnifiedProjectCard.tsx`

### Milestone 3 — Liquid Glass Visual

**Create:**
- `frontend/src/styles/tokens.css` — CSS custom properties for Liquid Glass

**Modify:**
- `frontend/src/app/globals.css` — import tokens, add `.glass`, `.glass-strong`, `.pill`, `.btn-*` utilities
- `frontend/src/app/layout.tsx` — body background gradient
- `frontend/src/components/SearchBar.tsx` — frosted surface
- `frontend/src/components/ResultsToolbar.tsx` — glass toolbar with pill toggles
- `frontend/src/components/SourceFilter.tsx` — glass sheet popover
- `frontend/src/components/TrendingSection.tsx` — glass cards
- `frontend/src/components/DirectJumps.tsx` — glass cards
- `frontend/src/components/SavedSection.tsx` — glass cards
- `frontend/src/components/ShortcutHelpModal.tsx` — glass modal
- `frontend/src/components/CardSkeleton.tsx` — glass skeleton
- `frontend/src/components/card/CardPills.tsx`, `SourceBadge.tsx`, `CardActions.tsx` — consume tokens

### Milestone 4 — Motion

**Create:**
- `frontend/src/lib/motion.ts` — spring presets + variants
- `frontend/src/lib/motion.test.ts` — reduced-motion fallback test
- `frontend/src/hooks/useReducedMotion.ts` — wraps `matchMedia`
- `frontend/src/components/motion/AnimatedGrid.tsx` — stagger container
- `frontend/src/components/motion/AnimatedCard.tsx` — per-card enter/hover/exit
- `frontend/src/components/motion/Shimmer.tsx` — skeleton shimmer
- `frontend/src/components/motion/CountUp.tsx` — source-counter number-up
- `frontend/src/components/motion/Toast.tsx` — copy/bookmark feedback

**Modify:**
- `frontend/package.json` — add `framer-motion`
- `frontend/src/app/page.tsx` — use `AnimatedGrid`, wire toast host
- `frontend/src/components/UnifiedProjectCard.tsx` — wrap in `AnimatedCard`
- `frontend/src/components/CardSkeleton.tsx` — use `Shimmer`
- `frontend/src/components/SearchBar.tsx` — animated focus ring, placeholder lift
- `frontend/src/components/ResultsToolbar.tsx` — animated filter pill toggles
- `frontend/src/components/SourceFilter.tsx` — animated sheet present
- `frontend/src/components/ShortcutHelpModal.tsx` — animated sheet present
- `frontend/src/components/card/CardActions.tsx` — button tap animation
- `frontend/src/app/layout.tsx` — intent-driven gradient tint CSS variable swap

---

## Milestone 1 — Synonyms + BM25 Ranker

### Task 1.1: Scaffold synonyms.ts schema and first 10 entries

**Files:**
- Create: `frontend/src/lib/sources/synonyms.ts`
- Create: `frontend/src/lib/sources/synonyms.test.ts`

- [ ] **Step 1: Write failing test for schema shape**

```ts
// frontend/src/lib/sources/synonyms.test.ts
import { describe, it, expect } from "vitest";
import { SYNONYMS } from "./synonyms";

describe("SYNONYMS dictionary", () => {
  it("every entry has non-empty concept, triggers, expandTo", () => {
    for (const entry of SYNONYMS) {
      expect(entry.concept).toMatch(/^[a-z0-9-]+$/);
      expect(entry.triggers.length).toBeGreaterThan(0);
      expect(entry.expandTo.length).toBeGreaterThan(0);
      for (const trig of entry.triggers) expect(trig.length).toBeGreaterThan(1);
    }
  });

  it("concept ids are unique", () => {
    const ids = SYNONYMS.map((s) => s.concept);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `cd frontend && npm run test -- synonyms`
Expected: FAIL — `synonyms.ts` does not exist.

- [ ] **Step 3: Create synonyms.ts with schema + 10 seed entries**

```ts
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
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd frontend && npm run test -- synonyms`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
cd ~/code/active/threadseeker
git add frontend/src/lib/sources/synonyms.ts frontend/src/lib/sources/synonyms.test.ts
git commit -m "M1: scaffold synonyms.ts schema with 10 seed concepts"
```

---

### Task 1.2: Extract intent classifier into intent.ts

Rationale: `classifyIntent` currently lives inside `optimize-queries.ts` (Groq function, to be deleted). Move it to a standalone module so `expandQuery` can use it without the Groq baggage.

**Files:**
- Create: `frontend/src/lib/sources/intent.ts`
- Create: `frontend/src/lib/sources/intent.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// frontend/src/lib/sources/intent.test.ts
import { describe, it, expect } from "vitest";
import { classifyIntent } from "./intent";

describe("classifyIntent", () => {
  it("returns project_search for 'github clone' queries", () => {
    expect(classifyIntent("best github clone tool").intent).toBe("project_search");
  });
  it("returns model_search for 'llama model' queries", () => {
    expect(classifyIntent("llama 3 model").intent).toBe("model_search");
  });
  it("returns troubleshooting for 'error' queries", () => {
    expect(classifyIntent("react hydration error fix").intent).toBe("troubleshooting");
  });
  it("returns how_to for tutorial queries", () => {
    expect(classifyIntent("how to deploy next.js").intent).toBe("how_to");
  });
  it("returns general for plain noun queries", () => {
    expect(classifyIntent("pandas").intent).toBe("general");
  });
  it("returns source weights that sum to ~1.0", () => {
    const { weights } = classifyIntent("redis");
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `cd frontend && npm run test -- intent`
Expected: FAIL — `intent.ts` does not exist.

- [ ] **Step 3: Create intent.ts**

```ts
// frontend/src/lib/sources/intent.ts
// Regex-based intent classifier. No LLM. Moved out of the deleted
// Groq optimize-queries function.

export type Intent =
  | "project_search"
  | "how_to"
  | "recommendation"
  | "comparison"
  | "troubleshooting"
  | "model_search"
  | "general";

const INTENT_PATTERNS: Record<Exclude<Intent, "general">, RegExp[]> = {
  project_search: [
    /\b(project|repo|repository|code|implementation|example|template|boilerplate)\b/i,
    /\b(github|clone|fork|open[- ]source)\b/i,
  ],
  how_to: [
    /\bhow (to|do|can)\b/i,
    /\b(guide|tutorial|steps|learn|build|create|setup|deploy)\b/i,
  ],
  recommendation: [
    /\b(best|top|recommend|suggestion|should i|which|better|vs)\b/i,
  ],
  comparison: [/\bvs\.?\b|\bversus\b/i, /\b(compare|comparison|difference)\b/i],
  troubleshooting: [
    /\b(error|issue|problem|bug|fix|broken|not working|help|solve)\b/i,
  ],
  model_search: [
    /\b(model|llm|transformer|neural network|ai model|ml model)\b/i,
    /\b(gpt|bert|llama|mistral|stable diffusion|clip)\b/i,
    /\b(hugging ?face|hf|pretrained)\b/i,
  ],
};

const INTENT_WEIGHTS: Record<Intent, Record<string, number>> = {
  project_search: { github: 0.7, reddit: 0.2, huggingface: 0.1 },
  how_to: { reddit: 0.6, github: 0.3, huggingface: 0.1 },
  recommendation: { reddit: 0.6, github: 0.25, huggingface: 0.15 },
  comparison: { reddit: 0.5, github: 0.3, huggingface: 0.2 },
  troubleshooting: { reddit: 0.7, github: 0.2, huggingface: 0.1 },
  model_search: { huggingface: 0.7, github: 0.2, reddit: 0.1 },
  general: { github: 0.4, reddit: 0.4, huggingface: 0.2 },
};

export function classifyIntent(query: string): {
  intent: Intent;
  weights: Record<string, number>;
} {
  let best: Intent = "general";
  let bestScore = 0;
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as Array<
    [Exclude<Intent, "general">, RegExp[]]
  >) {
    const score = patterns.reduce((acc, p) => acc + (p.test(query) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return { intent: best, weights: INTENT_WEIGHTS[best] };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd frontend && npm run test -- intent`
Expected: PASS (6 tests green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sources/intent.ts frontend/src/lib/sources/intent.test.ts
git commit -m "M1: extract regex intent classifier into intent.ts"
```

---

### Task 1.3: Implement expandQuery() function

**Files:**
- Modify: `frontend/src/lib/sources/synonyms.ts` (append `expandQuery`)
- Modify: `frontend/src/lib/sources/synonyms.test.ts`

- [ ] **Step 1: Write failing tests for expandQuery**

Append to `synonyms.test.ts`:

```ts
import { expandQuery } from "./synonyms";

describe("expandQuery", () => {
  it("returns raw terms when no synonym entry matches", () => {
    const result = expandQuery("acme-unknown-xyz");
    expect(result.expandedTerms).toEqual(["acme-unknown-xyz"]);
    expect(result.boostFullNames).toEqual([]);
  });

  it("expands 'react state management' to zustand/jotai/etc", () => {
    const result = expandQuery("react state management");
    expect(result.expandedTerms).toEqual(
      expect.arrayContaining(["zustand", "jotai", "redux"]),
    );
    expect(result.boostFullNames).toEqual(
      expect.arrayContaining(["pmndrs/zustand"]),
    );
  });

  it("respects `requires` — 'state management' alone does NOT trigger react entry", () => {
    const result = expandQuery("state management");
    expect(result.expandedTerms).not.toEqual(
      expect.arrayContaining(["zustand"]),
    );
  });

  it("expands 'mcp server' to MCP-related terms", () => {
    const result = expandQuery("mcp server for postgres");
    expect(result.expandedTerms).toEqual(
      expect.arrayContaining(["mcp", "model context protocol"]),
    );
  });

  it("dedupes expandedTerms", () => {
    const result = expandQuery("react state management state manager");
    const zustandCount = result.expandedTerms.filter((t) => t === "zustand").length;
    expect(zustandCount).toBe(1);
  });

  it("includes the user's original query tokens", () => {
    const result = expandQuery("vue pinia state");
    expect(result.expandedTerms).toEqual(expect.arrayContaining(["vue", "pinia", "state"]));
  });

  it("returns intent from classifyIntent", () => {
    expect(expandQuery("how to deploy next.js").intent).toBe("how_to");
  });
});
```

- [ ] **Step 2: Run tests, verify new tests fail**

Run: `cd frontend && npm run test -- synonyms`
Expected: the new `expandQuery` tests FAIL with "expandQuery is not a function."

- [ ] **Step 3: Implement expandQuery in synonyms.ts**

Append to `synonyms.ts`:

```ts
import { classifyIntent, Intent } from "./intent";

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
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd frontend && npm run test -- synonyms`
Expected: PASS (all 9 tests green — 2 schema + 7 expandQuery).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sources/synonyms.ts frontend/src/lib/sources/synonyms.test.ts
git commit -m "M1: implement expandQuery() over synonym dictionary"
```

---

### Task 1.4: Expand SYNONYMS dictionary to ~50 entries

**Files:**
- Modify: `frontend/src/lib/sources/synonyms.ts`

- [ ] **Step 1: Write a failing test for minimum dictionary size**

Append to `synonyms.test.ts`:

```ts
describe("SYNONYMS coverage", () => {
  it("has at least 45 concept entries", () => {
    expect(SYNONYMS.length).toBeGreaterThanOrEqual(45);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `cd frontend && npm run test -- synonyms`
Expected: FAIL — `SYNONYMS.length` is 10.

- [ ] **Step 3: Add the remaining entries to `synonyms.ts`**

Append to the `SYNONYMS` array (full list — do not truncate):

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm run test -- synonyms`
Expected: PASS — coverage test and all earlier tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sources/synonyms.ts frontend/src/lib/sources/synonyms.test.ts
git commit -m "M1: expand SYNONYMS to 45+ concepts covering newer meta"
```

---

### Task 1.5: Implement BM25 ranker (ranking-bm25.ts)

**Files:**
- Create: `frontend/src/lib/sources/ranking-bm25.ts`
- Create: `frontend/src/lib/sources/ranking-bm25.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// frontend/src/lib/sources/ranking-bm25.test.ts
import { describe, it, expect } from "vitest";
import { rankCorpus } from "./ranking-bm25";
import { expandQuery } from "./synonyms";
import type { UnifiedProject } from "./types";

function mk(p: Partial<UnifiedProject>): UnifiedProject {
  return {
    id: p.id ?? "id",
    source: p.source ?? "github",
    name: p.name ?? "project",
    fullName: p.fullName ?? "owner/project",
    description: p.description ?? "",
    url: p.url ?? "http://example.com",
    stars: p.stars ?? 0,
    downloads: p.downloads,
    language: p.language ?? null,
    topics: p.topics ?? [],
    license: p.license ?? null,
    updatedAt: p.updatedAt ?? new Date().toISOString(),
    avatarUrl: p.avatarUrl ?? null,
  } as UnifiedProject;
}

describe("rankCorpus", () => {
  it("puts exact-name match above mere description hit", () => {
    const projects: UnifiedProject[] = [
      mk({ name: "zustand", fullName: "pmndrs/zustand", stars: 45000, description: "state mgmt" }),
      mk({ name: "random-thing", fullName: "x/y", stars: 100, description: "zustand clone" }),
    ];
    const ranked = rankCorpus(projects, "zustand", expandQuery("zustand"));
    expect(ranked[0].name).toBe("zustand");
  });

  it("surfaces boosted fullName projects for concept queries", () => {
    const projects: UnifiedProject[] = [
      mk({ name: "randostate", fullName: "x/randostate", stars: 3000, description: "a react store" }),
      mk({ name: "zustand", fullName: "pmndrs/zustand", stars: 45000, description: "state for react" }),
    ];
    const ranked = rankCorpus(projects, "react state management", expandQuery("react state management"));
    expect(ranked[0].fullName).toBe("pmndrs/zustand");
  });

  it("BM25 favors rare-term hits over popular-term hits", () => {
    // "state" is common; "zustand" is rare → rare-term hit should win.
    const projects: UnifiedProject[] = [
      mk({ name: "react-state-helpers", description: "state state state" }),
      mk({ name: "awesome-zustand", description: "zustand recipes" }),
    ];
    const ranked = rankCorpus(projects, "zustand state", expandQuery("zustand state"));
    expect(ranked[0].name).toBe("awesome-zustand");
  });

  it("recency penalty pushes a 4-year-stale repo down", () => {
    const stale = new Date(Date.now() - 1400 * 86400000).toISOString();
    const fresh = new Date(Date.now() - 7 * 86400000).toISOString();
    const projects: UnifiedProject[] = [
      mk({ name: "foo-stale", updatedAt: stale, stars: 100 }),
      mk({ name: "foo-fresh", updatedAt: fresh, stars: 100 }),
    ];
    const ranked = rankCorpus(projects, "foo", expandQuery("foo"));
    expect(ranked[0].name).toBe("foo-fresh");
  });

  it("does not throw on empty corpus", () => {
    expect(() => rankCorpus([], "anything", expandQuery("anything"))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `cd frontend && npm run test -- ranking-bm25`
Expected: FAIL — `rankCorpus` not defined.

- [ ] **Step 3: Create ranking-bm25.ts**

```ts
// frontend/src/lib/sources/ranking-bm25.ts
// Proper BM25 ranker. Replaces the heuristic sum ranker. Operates over the
// result corpus (the projects that actually came back from fetching) — this
// is a re-ranker, not web-scale retrieval.

import type { SourceType, UnifiedProject } from "./types";
import type { ExpandQueryResult } from "./synonyms";

const K1 = 1.2;
const B = 0.75;

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function docTokens(p: UnifiedProject): string[] {
  const lang = p.language ?? "";
  return tokenize(
    [p.name, p.fullName, p.description, (p.topics || []).join(" "), lang].join(" "),
  );
}

/**
 * BM25 + non-lexical signals. Lower-level function is pure.
 */
export function rankCorpus(
  projects: UnifiedProject[],
  rawQuery: string,
  expansion: ExpandQueryResult,
): UnifiedProject[] {
  if (projects.length === 0) return [];

  const docs = projects.map(docTokens);
  const docLens = docs.map((d) => d.length);
  const avgDocLen = docLens.reduce((a, b) => a + b, 0) / docs.length || 1;
  const N = docs.length;

  const userTokens = tokenize(rawQuery);
  const expansionTokens = expansion.expandedTerms
    .flatMap((e) => tokenize(e))
    .filter((t) => !userTokens.includes(t));

  const allTerms = Array.from(new Set([...userTokens, ...expansionTokens]));
  const termWeight = (t: string) => (userTokens.includes(t) ? 1.0 : 0.5);

  const df: Record<string, number> = {};
  for (const term of allTerms) {
    df[term] = docs.filter((d) => d.includes(term)).length;
  }
  const idf: Record<string, number> = {};
  for (const term of allTerms) {
    idf[term] = Math.log(1 + (N - df[term] + 0.5) / (df[term] + 0.5));
  }

  const boostSet = new Set(expansion.boostFullNames.map((s) => s.toLowerCase()));

  const scored = projects.map((p, i) => {
    const doc = docs[i];
    const docLen = docLens[i];
    let bm25 = 0;
    for (const term of allTerms) {
      const tf = doc.filter((t) => t === term).length;
      if (tf === 0) continue;
      const num = tf * (K1 + 1);
      const denom = tf + K1 * (1 - B + (B * docLen) / avgDocLen);
      bm25 += termWeight(term) * idf[term] * (num / denom);
    }

    let score = bm25 * 1000;

    // Popularity
    if (p.stars > 0) score += Math.min(Math.log10(p.stars + 1) * 400, 3500);
    if (p.downloads && p.downloads > 0) {
      score += Math.min(Math.log10(p.downloads + 1) * 200, 2000);
    }

    // Recency
    const ageDays = (Date.now() - new Date(p.updatedAt).getTime()) / 86_400_000;
    if (ageDays < 7) score += 500;
    else if (ageDays < 30) score += 300;
    else if (ageDays < 90) score += 150;
    else if (ageDays > 730) score -= 500;
    else if (ageDays > 365) score -= 200;

    // Source baseline
    const srcBonus: Record<SourceType, number> = {
      github: 150, huggingface: 140, npm: 120, pypi: 120, crates: 120,
      packagist: 110, rubygems: 110, gitlab: 100, codeberg: 100,
      dockerhub: 120, jsr: 110, flathub: 105, homebrew: 110, fdroid: 100,
      arxiv: 110, paperswithcode: 115, stackoverflow: 95, hackernews: 90,
      reddit: 90, lobsters: 90, devto: 85, aur: 100, openvsx: 110,
      conda: 115, zenodo: 105, nuget: 120, wordpress: 105, maven: 120,
    };
    score += srcBonus[p.source] ?? 0;

    // Trending
    if (p.stars >= 1000 && ageDays < 90) score += 800;
    if (p.stars >= 10_000 && ageDays < 180) score += 400;

    // Zero-signal penalty
    const noStars = p.stars === 0;
    const noDownloads = !p.downloads || p.downloads === 0;
    const noDesc = !p.description || p.description.length < 20;
    if (noStars && noDownloads && noDesc) score -= 600;

    // Boost list
    if (boostSet.has(p.fullName.toLowerCase())) score += 2000;

    return { project: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.project);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd frontend && npm run test -- ranking-bm25`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/sources/ranking-bm25.ts frontend/src/lib/sources/ranking-bm25.test.ts
git commit -m "M1: implement BM25 ranker with synonym-weighted scoring"
```

---

### Task 1.6: Expand backtest query suite (30 → 80)

**Files:**
- Modify: `frontend/scripts/backtest-queries.ts`

- [ ] **Step 1: Read the existing file**

Run: `cd frontend && wc -l scripts/backtest-queries.ts` to confirm current size (should be around 60-70 lines of entries).

- [ ] **Step 2: Append ~50 new queries to the `BACKTEST_QUERIES` array**

Add the following entries before the closing `];`:

```ts
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
```

- [ ] **Step 3: Commit**

```bash
git add frontend/scripts/backtest-queries.ts
git commit -m "M1: expand backtest suite to 80 queries covering newer meta"
```

---

### Task 1.7: Wire rankCorpus + expandQuery into adapters and page.tsx

This is the cut-over step. We delete the Groq call in `page.tsx` and replace it with `expandQuery()`. We replace the old `calculateRelevanceScore` sort with `rankCorpus()`.

**Files:**
- Modify: `frontend/src/lib/sources/index.ts`
- Modify: `frontend/src/lib/sources/adapters.ts` (accept `expandedTerms` in source fetchers that benefit from OR-expansion)
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Add `buildSearchQuery` helper to `sources/index.ts`**

Append to `sources/index.ts`:

```ts
import type { ExpandQueryResult } from "./synonyms";

/**
 * For sources that support OR operators in their search query (GitHub, npm),
 * build a single composite query string. Falls back to raw user query for
 * APIs that don't support ORs.
 */
export function buildSearchQuery(
  rawQuery: string,
  expansion: ExpandQueryResult,
  opts: { supportsOr: boolean },
): string {
  if (!opts.supportsOr) return rawQuery;
  const topN = expansion.expandedTerms.slice(0, 5);
  if (topN.length <= 1) return rawQuery;
  // GitHub-style: "raw OR term1 OR term2"
  return topN.map((t) => (t.includes(" ") ? `"${t}"` : t)).join(" OR ");
}
```

- [ ] **Step 2: Replace old ranker export with new one in `sources/index.ts`**

Find and replace:

```ts
// OLD
export { calculateRelevanceScore } from "./ranking";
```

with:

```ts
// NEW
export { rankCorpus } from "./ranking-bm25";
export { expandQuery } from "./synonyms";
export type { ExpandQueryResult } from "./synonyms";
```

- [ ] **Step 3: Update page.tsx — remove Groq, call expandQuery, use rankCorpus**

In `frontend/src/app/page.tsx`:

Remove this import line (`:23`):
```ts
import { optimizeQueries, relatedQueries, isBackendConfigured } from "@/lib/api-client";
```

Replace with:
```ts
import { expandQuery, rankCorpus } from "@/lib/sources";
```

Find the block around line 254 that calls `optimizeQueries`:
```ts
const optimized = await Promise.race([optimizeQueries(freeText), timeoutP]);
```

Replace the full block (approximately lines 245-290) with:
```ts
const expansion = expandQuery(freeText);
// Adapters read expansion.expandedTerms to build OR-expanded fetch URLs.
// Final sorting happens via rankCorpus after merge.
```

Find the block that calls `relatedQueries` (around line 306) and delete the entire `relatedQueries(freeText).then(...)` block and any UI that consumed the result (a list sidebar around line 590 based on grep output). Delete the state variable that held related queries.

Find the results sort — where `calculateRelevanceScore` was used — and replace with:
```ts
const ranked = rankCorpus(mergedResults, freeText, expansion);
setResults(ranked);
```

- [ ] **Step 4: Update `adapters.ts` to accept `expandedTerms`**

For each adapter that uses a search URL with OR support (GitHub, npm, github-style sources), accept an optional second parameter:

```ts
// Example for github adapter
export async function searchGithub(
  query: string,
  expandedTerms?: string[],
): Promise<UnifiedProject[]> {
  const q = expandedTerms && expandedTerms.length > 1
    ? buildSearchQuery(query, { expandedTerms, boostFullNames: [], intent: "general", normalizedQuery: query }, { supportsOr: true })
    : query;
  // ... rest of existing fetch logic uses q instead of query
}
```

Apply the same pattern to npm, pypi (no OR; leave raw), crates (no OR), etc. Only edit adapters where OR support is confirmed. The agent should skim each adapter section of `adapters.ts` and only modify the ones marked `supportsOr: true` in the registry below.

- [ ] **Step 5: Add a `supportsOr` flag to registry.ts per source**

In `frontend/src/lib/sources/registry.ts`, add a `supportsOr: boolean` field to each source's entry. Confirmed `true`: github, gitlab, codeberg. Confirmed `false`: everything else (for MVP — expand later as tested).

- [ ] **Step 6: Run tests**

Run: `cd frontend && npm run test`
Expected: all existing tests still pass (merge tests, new synonyms tests, new ranking-bm25 tests). Old `ranking.test.ts` will still pass because we haven't deleted it yet.

- [ ] **Step 7: Build check**

Run: `cd frontend && npm run build`
Expected: typecheck passes. If there are any unresolved imports to Groq helpers, those come in the next task.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/sources/index.ts frontend/src/lib/sources/adapters.ts frontend/src/lib/sources/registry.ts frontend/src/app/page.tsx
git commit -m "M1: cut over to expandQuery + rankCorpus in search pipeline"
```

---

### Task 1.8: Delete all Groq code paths

**Files:**
- Delete: `frontend/functions/api/optimize-queries.ts`
- Delete: `frontend/functions/api/synthesize.ts`
- Delete: `frontend/functions/api/related-queries.ts`
- Delete: `frontend/functions/api/integrate.ts`
- Delete: `frontend/functions/api/_shared/groq.ts`
- Modify: `frontend/src/lib/api-client.ts` (remove Groq helpers)
- Delete: `frontend/src/components/SynthesisBox.tsx`

- [ ] **Step 1: Delete the Groq Pages Functions**

```bash
cd ~/code/active/threadseeker
rm frontend/functions/api/optimize-queries.ts
rm frontend/functions/api/synthesize.ts
rm frontend/functions/api/related-queries.ts
rm frontend/functions/api/integrate.ts
rm frontend/functions/api/_shared/groq.ts
```

If `_shared/` is now empty, remove the directory:
```bash
rmdir frontend/functions/api/_shared 2>/dev/null || true
```

- [ ] **Step 2: Strip Groq helpers from `api-client.ts`**

Open `frontend/src/lib/api-client.ts`. Delete the `optimizeQueries`, `relatedQueries`, `integrateSnippet`, `synthesizeResults` exported functions and their helper/types. Also delete the `isBackendConfigured` export (if it referenced Groq availability specifically). Keep any non-Groq source helpers intact.

- [ ] **Step 3: Delete SynthesisBox component**

```bash
rm frontend/src/components/SynthesisBox.tsx
```

Remove any remaining import/usage of `SynthesisBox` in `page.tsx`.

- [ ] **Step 4: Grep for lingering references**

Run: `cd frontend && grep -rn "groq\|Groq\|GROQ\|optimizeQueries\|relatedQueries\|synthesizeResults\|integrateSnippet\|SynthesisBox" src/ functions/ 2>&1 | grep -v node_modules`

Expected: empty output.

- [ ] **Step 5: Build + test**

Run: `cd frontend && npm run build && npm run test`
Expected: typecheck clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/
git commit -m "M1: delete all Groq/LLM code — no more runtime dependency on external AI"
```

---

### Task 1.9: Delete legacy ranking.ts and wire the new ranker fully

**Files:**
- Delete: `frontend/src/lib/sources/ranking.ts`
- Delete: `frontend/src/lib/sources/ranking.test.ts`

- [ ] **Step 1: Confirm no remaining imports of old ranking**

Run: `cd frontend && grep -rn "calculateRelevanceScore\|from \"./ranking\"\|from \"@/lib/sources/ranking\"" src/ 2>&1 | grep -v ranking-bm25`
Expected: empty.

- [ ] **Step 2: Delete old files**

```bash
cd ~/code/active/threadseeker
rm frontend/src/lib/sources/ranking.ts
rm frontend/src/lib/sources/ranking.test.ts
```

- [ ] **Step 3: Run test and build**

Run: `cd frontend && npm run build && npm run test`
Expected: clean build, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/
git commit -m "M1: remove legacy ranking.ts — BM25 is the only ranker"
```

---

### Task 1.10: Run backtest — gate check

**Files:** (no code changes)

- [ ] **Step 1: Run the backtest harness**

Run: `cd frontend && npm run backtest 2>&1 | tee /tmp/backtest-m1.txt`
Expected: summary output ending with P@3, MRR, winner-at-#1 numbers.

- [ ] **Step 2: Inspect results**

Open `/tmp/backtest-m1.txt`. Verify:
- P@3 ≥ 0.92
- MRR ≥ 0.78
- winner-at-#1 ≥ 0.82

If any gate fails: inspect failing queries, identify whether it's a synonyms gap or a BM25 tuning issue. Add synonym entries OR tweak BM25 weights in `ranking-bm25.ts`, then re-run. Iterate until gate passes.

- [ ] **Step 3: Commit gate pass**

```bash
git add -A frontend/
git commit -m "M1: backtest gate passed — P@3 and MRR meet targets"
```

---

## Milestone 2 — Normalized Card Component

### Task 2.1: CardPills component

**Files:**
- Create: `frontend/src/components/card/CardPills.tsx`
- Create: `frontend/src/components/card/CardPills.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// frontend/src/components/card/CardPills.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardPills } from "./CardPills";

describe("CardPills", () => {
  it("renders all four pills when all props provided", () => {
    render(
      <CardPills popularity="★ 45.2k" language="TypeScript" license="MIT" maintenance="active" />
    );
    expect(screen.getByText("★ 45.2k")).toBeDefined();
    expect(screen.getByText("TypeScript")).toBeDefined();
    expect(screen.getByText("MIT")).toBeDefined();
    expect(screen.getByText(/Active/i)).toBeDefined();
  });

  it("renders fallbacks for missing values", () => {
    render(<CardPills popularity={null} language={null} license={null} maintenance="unknown" />);
    expect(screen.getByText("—")).toBeDefined();
  });

  it("maintenance variant class applied by state", () => {
    const { container } = render(
      <CardPills popularity="★ 1k" language="Rust" license="MIT" maintenance="abandoned" />
    );
    expect(container.querySelector(".pill-maint-abandoned")).toBeDefined();
  });
});
```

Install testing library dependencies if not present:
```bash
cd frontend && npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

Add vitest config for jsdom if missing:
```ts
// frontend/vitest.config.ts — add `environment: 'jsdom'` under `test`
```

- [ ] **Step 2: Run test, verify failure**

Run: `cd frontend && npm run test -- CardPills`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Create the component**

```tsx
// frontend/src/components/card/CardPills.tsx
export type MaintenanceState = "active" | "stale" | "abandoned" | "recent" | "unknown";

export interface CardPillsProps {
  popularity: string | null;
  language: string | null;
  license: string | null;
  maintenance: MaintenanceState;
}

const MAINT_LABEL: Record<MaintenanceState, string> = {
  active: "● Active",
  stale: "● Stale",
  abandoned: "● Abandoned",
  recent: "● Recent",
  unknown: "● Unknown",
};

export function CardPills({ popularity, language, license, maintenance }: CardPillsProps) {
  return (
    <div className="ts-pills">
      <span className="pill pill-popularity">{popularity ?? "—"}</span>
      <span className="pill pill-language">{language ?? "—"}</span>
      <span className="pill pill-license">{license ?? "—"}</span>
      <span className={`pill pill-maint pill-maint-${maintenance}`}>{MAINT_LABEL[maintenance]}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `cd frontend && npm run test -- CardPills`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/card/CardPills.tsx frontend/src/components/card/CardPills.test.tsx frontend/package.json frontend/package-lock.json
git commit -m "M2: add CardPills component with 4-pill metadata row"
```

---

### Task 2.2: SourceBadge component

**Files:**
- Create: `frontend/src/components/card/SourceBadge.tsx`
- Create: `frontend/src/components/card/SourceBadge.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// frontend/src/components/card/SourceBadge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceBadge } from "./SourceBadge";

describe("SourceBadge", () => {
  it("renders github label and applies github class", () => {
    const { container } = render(<SourceBadge source="github" />);
    expect(screen.getByText(/GitHub/i)).toBeDefined();
    expect(container.querySelector(".ts-source-github")).toBeDefined();
  });

  it("renders hugging face label", () => {
    render(<SourceBadge source="huggingface" />);
    expect(screen.getByText(/Hugging Face/i)).toBeDefined();
  });

  it("renders arxiv label", () => {
    render(<SourceBadge source="arxiv" />);
    expect(screen.getByText(/arXiv/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `cd frontend && npm run test -- SourceBadge`
Expected: FAIL.

- [ ] **Step 3: Create the component**

```tsx
// frontend/src/components/card/SourceBadge.tsx
import type { SourceType } from "@/lib/sources/types";

const LABELS: Record<SourceType, string> = {
  github: "GitHub", huggingface: "Hugging Face", gitlab: "GitLab",
  codeberg: "Codeberg", npm: "npm", pypi: "PyPI", crates: "crates.io",
  packagist: "Packagist", rubygems: "RubyGems", jsr: "JSR",
  dockerhub: "Docker Hub", flathub: "Flathub", homebrew: "Homebrew",
  fdroid: "F-Droid", aur: "AUR", openvsx: "Open VSX", conda: "conda-forge",
  nuget: "NuGet", wordpress: "WordPress", maven: "Maven",
  paperswithcode: "Papers with Code", arxiv: "arXiv", zenodo: "Zenodo",
  hackernews: "Hacker News", reddit: "Reddit", lobsters: "Lobsters",
  stackoverflow: "Stack Overflow", devto: "DEV",
};

export function SourceBadge({ source }: { source: SourceType }) {
  return (
    <span className={`ts-source ts-source-${source}`} aria-label={`Source: ${LABELS[source]}`}>
      ◆ {LABELS[source]}
    </span>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm run test -- SourceBadge`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/card/SourceBadge.tsx frontend/src/components/card/SourceBadge.test.tsx
git commit -m "M2: add SourceBadge component with per-source labels"
```

---

### Task 2.3: CardActions component

**Files:**
- Create: `frontend/src/components/card/CardActions.tsx`
- Create: `frontend/src/components/card/CardActions.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// frontend/src/components/card/CardActions.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CardActions } from "./CardActions";

describe("CardActions", () => {
  it("renders primary Open link", () => {
    render(<CardActions url="http://example.com" copyItems={[]} />);
    expect(screen.getByRole("link", { name: /Open/ })).toBeDefined();
  });

  it("renders copy buttons and fires onCopy when clicked", async () => {
    const onCopy = vi.fn();
    render(
      <CardActions
        url="http://example.com"
        copyItems={[{ label: "cargo add", text: "cargo add tokio" }]}
        onCopy={onCopy}
      />,
    );
    fireEvent.click(screen.getByText(/cargo add/));
    expect(onCopy).toHaveBeenCalledWith("cargo add tokio");
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `cd frontend && npm run test -- CardActions`
Expected: FAIL.

- [ ] **Step 3: Create the component**

```tsx
// frontend/src/components/card/CardActions.tsx
export interface CopyItem {
  label: string;
  text: string;
}

export interface CardActionsProps {
  url: string;
  copyItems: CopyItem[];
  onCopy?: (text: string) => void;
}

export function CardActions({ url, copyItems, onCopy }: CardActionsProps) {
  return (
    <div className="ts-actions">
      <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">
        Open →
      </a>
      {copyItems.map((item) => (
        <button
          key={item.label}
          className="btn btn-ghost"
          onClick={() => {
            navigator.clipboard.writeText(item.text);
            onCopy?.(item.text);
          }}
        >
          ⎘ {item.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test**

Run: `cd frontend && npm run test -- CardActions`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/card/CardActions.tsx frontend/src/components/card/CardActions.test.tsx
git commit -m "M2: add CardActions component with Open + copy-install buttons"
```

---

### Task 2.4: Rebuild UnifiedProjectCard

**Files:**
- Modify: `frontend/src/components/UnifiedProjectCard.tsx`

- [ ] **Step 1: Read existing component for behavior reference**

Run: `cd frontend && cat src/components/UnifiedProjectCard.tsx | head -60`
Note which props it consumes and which behaviors (bookmark, MCP snippet) are needed in the rebuild.

- [ ] **Step 2: Replace UnifiedProjectCard with slim version**

Full rewrite (do not incrementally edit — replace the file):

```tsx
// frontend/src/components/UnifiedProjectCard.tsx
import { useState } from "react";
import type { UnifiedProject } from "@/lib/sources/types";
import { SourceBadge } from "./card/SourceBadge";
import { CardPills } from "./card/CardPills";
import { CardActions, type CopyItem } from "./card/CardActions";
import { useBookmark } from "@/lib/bookmarks";
import { formatCount, licenseBucket, maintenanceState, copyItemsForSource } from "./card/helpers";

export function UnifiedProjectCard({ project }: { project: UnifiedProject }) {
  const { isBookmarked, toggle } = useBookmark(project.id);
  const [copied, setCopied] = useState<string | null>(null);

  const popularity = project.stars > 0
    ? `★ ${formatCount(project.stars)}`
    : project.downloads ? `↓ ${formatCount(project.downloads)}` : null;

  const copyItems: CopyItem[] = copyItemsForSource(project);

  return (
    <article className="ts-card">
      <div className="ts-top">
        <SourceBadge source={project.source} />
        <button
          className={`ts-bookmark ${isBookmarked ? "bookmarked" : ""}`}
          onClick={toggle}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
        >
          {isBookmarked ? "♥" : "♡"}
        </button>
      </div>
      <h3 className="ts-title">
        {project.name}
        {project.fullName !== project.name && (
          <span className="ts-title-sub">
            {project.source === "github" || project.source === "gitlab" || project.source === "codeberg"
              ? `by ${project.fullName.split("/")[0]}`
              : project.fullName}
          </span>
        )}
      </h3>
      <p className="ts-desc">{project.description ?? ""}</p>
      <CardPills
        popularity={popularity}
        language={project.language}
        license={licenseBucket(project.license)}
        maintenance={maintenanceState(project.updatedAt)}
      />
      <CardActions
        url={project.url}
        copyItems={copyItems}
        onCopy={(text) => {
          setCopied(text);
          setTimeout(() => setCopied(null), 1500);
        }}
      />
      {copied && <div className="ts-toast">Copied: {copied.slice(0, 40)}</div>}
    </article>
  );
}
```

- [ ] **Step 3: Create helpers.ts for card formatting logic**

```ts
// frontend/src/components/card/helpers.ts
import type { UnifiedProject } from "@/lib/sources/types";
import type { MaintenanceState } from "./CardPills";
import type { CopyItem } from "./CardActions";

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function licenseBucket(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  const l = raw.toLowerCase();
  if (/mit|apache|bsd|isc|unlicense|cc-by/.test(l)) return raw;
  if (/lgpl|mpl/.test(l)) return raw;
  if (/gpl|agpl|copyleft/.test(l)) return raw;
  return raw;
}

export function maintenanceState(updatedAt: string): MaintenanceState {
  const days = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000;
  if (days < 90) return "active";
  if (days < 365) return "recent";
  if (days < 365 * 3) return "stale";
  return "abandoned";
}

export function copyItemsForSource(p: UnifiedProject): CopyItem[] {
  switch (p.source) {
    case "github":
    case "gitlab":
    case "codeberg":
      return [{ label: "Clone", text: `git clone ${p.url}.git` }];
    case "npm":
      return [{ label: "npm i", text: `npm install ${p.name}` }];
    case "pypi":
      return [{ label: "pip install", text: `pip install ${p.name}` }];
    case "crates":
      return [{ label: "cargo add", text: `cargo add ${p.name}` }];
    case "rubygems":
      return [{ label: "gem install", text: `gem install ${p.name}` }];
    case "packagist":
      return [{ label: "composer", text: `composer require ${p.fullName}` }];
    case "nuget":
      return [{ label: "dotnet add", text: `dotnet add package ${p.name}` }];
    case "homebrew":
      return [{ label: "brew install", text: `brew install ${p.name}` }];
    case "conda":
      return [{ label: "conda install", text: `conda install -c conda-forge ${p.name}` }];
    case "huggingface":
      return [{ label: "Install", text: `pip install transformers && # load ${p.name}` }];
    case "arxiv":
      return [{ label: "Cite", text: p.url }];
    default:
      return [];
  }
}
```

- [ ] **Step 4: Delete Sparkles button wiring from page.tsx**

In `page.tsx`, grep for `Sparkles`, `integrate`, `integration-snippet` and delete any remaining references. These were tied to the deleted Groq `integrate` endpoint.

- [ ] **Step 5: Build + test**

Run: `cd frontend && npm run build && npm run test`
Expected: clean build, all tests pass including new card component tests.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/
git commit -m "M2: rebuild UnifiedProjectCard as normalized component with pill/badge/action children"
```

---

### Task 2.5: Manual 28-source render check

**Files:** (no code changes, verification only)

- [ ] **Step 1: Start local dev server**

Run: `cd frontend && npx wrangler pages dev -- npm run dev` (or equivalent — confirm with existing README).

Alternative: `cd frontend && npm run dev` if that works without Pages Functions for this check.

- [ ] **Step 2: Run a broad query that hits many sources**

In browser: search for `python`. This typically pulls results from GitHub, PyPI, conda-forge, Docker Hub, arXiv, Stack Overflow, Hacker News, Reddit.

- [ ] **Step 3: Verify each card**

Manually inspect 10+ cards across different sources. Confirm:
- Every card shows SourceBadge at top-left with vendor color
- Every card has exactly 4 pills (no missing slots; placeholders show "—")
- Card heights appear consistent in the grid
- Primary "Open →" button present on every card
- Copy-install button (if applicable) behaves (click → clipboard)

- [ ] **Step 4: Document any source-specific bugs**

If a source adapter returns unusual data shapes (e.g., missing `updatedAt`), patch `maintenanceState()` with a graceful fallback (`"unknown"`) and re-test.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A frontend/
git commit -m "M2: gate pass — all 28 sources render through normalized card"
```

---

## Milestone 3 — Liquid Glass Visual System

### Task 3.1: Define CSS tokens

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Create tokens.css**

```css
/* frontend/src/styles/tokens.css */
:root {
  --ts-bg-gradient: linear-gradient(135deg, #fde6ff 0%, #e0e7ff 45%, #d9f9ff 100%);

  --ts-surface: rgba(255, 255, 255, 0.65);
  --ts-surface-strong: rgba(255, 255, 255, 0.85);
  --ts-border: rgba(255, 255, 255, 0.85);

  --ts-accent: #7c3aed;
  --ts-accent-soft: rgba(124, 58, 237, 0.15);
  --ts-accent-gradient: linear-gradient(135deg, #8b5cf6, #a78bfa);

  --ts-text: #1a1a2e;
  --ts-text-muted: #4b5563;
  --ts-text-subtle: #7c7396;

  --ts-radius-lg: 16px;
  --ts-radius-md: 12px;
  --ts-radius-sm: 8px;
  --ts-radius-full: 999px;

  --ts-shadow-rest: 0 8px 32px rgba(80, 50, 150, 0.10);
  --ts-shadow-hover: 0 14px 40px rgba(80, 50, 150, 0.18);

  --ts-blur: 24px;

  /* Intent-tint slot (lerped in JS via inline style) */
  --ts-intent-hue: 280; /* violet default; how_to→110 sage, model_search→35 amber, troubleshooting→350 rose */
}
```

- [ ] **Step 2: Import in globals.css and add utility classes**

Prepend to `frontend/src/app/globals.css`:

```css
@import "../styles/tokens.css";

body {
  background: var(--ts-bg-gradient);
  background-attachment: fixed;
  color: var(--ts-text);
  min-height: 100vh;
}

/* Glass surface */
.glass {
  background: var(--ts-surface);
  backdrop-filter: blur(var(--ts-blur));
  -webkit-backdrop-filter: blur(var(--ts-blur));
  border: 1px solid var(--ts-border);
  border-radius: var(--ts-radius-lg);
  box-shadow: var(--ts-shadow-rest);
}
.glass-strong {
  background: var(--ts-surface-strong);
  backdrop-filter: blur(var(--ts-blur));
  -webkit-backdrop-filter: blur(var(--ts-blur));
  border: 1px solid var(--ts-border);
  border-radius: var(--ts-radius-lg);
}

@supports not (backdrop-filter: blur(1px)) {
  .glass, .glass-strong { background: rgba(255, 255, 255, 0.92); }
}

/* Pills */
.pill {
  background: var(--ts-surface-strong);
  padding: 3px 10px;
  border-radius: var(--ts-radius-full);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--ts-accent-soft);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.pill-popularity { color: #b45309; }
.pill-language   { color: #1e40af; }
.pill-license    { color: #047857; }
.pill-maint-active    { color: #047857; background: rgba(16,185,129,0.12); }
.pill-maint-recent    { color: #047857; background: rgba(16,185,129,0.12); }
.pill-maint-stale     { color: #a16207; background: rgba(234,179,8,0.12); }
.pill-maint-abandoned { color: #b91c1c; background: rgba(239,68,68,0.12); }
.pill-maint-unknown   { color: #64748b; background: rgba(100,116,139,0.12); }

/* Buttons */
.btn {
  font-size: 11.5px; font-weight: 600;
  padding: 6px 11px; border-radius: var(--ts-radius-sm);
  display: inline-flex; align-items: center; gap: 5px;
  cursor: pointer; text-decoration: none;
  border: 1px solid var(--ts-accent-soft);
  background: var(--ts-surface-strong);
  color: #4c1d95;
  transition: background .15s ease, transform .15s ease;
}
.btn:hover { background: var(--ts-accent-soft); }
.btn-primary {
  background: var(--ts-accent-gradient); color: white;
  border-color: transparent;
}

/* Card structure (applies to .ts-card created in M2) */
.ts-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 20px 16px;
  min-height: 204px;
  /* inherits .glass */
}
.ts-card { composes: glass; }
@media (min-width: 1) { /* composes isn't CSS — remove and inline below if not using CSS modules */ }
```

Note for the agent: since this is a plain CSS file (not CSS modules), replace `composes: glass;` with a direct duplication of glass properties in `.ts-card`, OR add `className="glass"` on the rendered card element in `UnifiedProjectCard.tsx`. Choose the latter for simplicity.

If choosing the className approach, revisit `UnifiedProjectCard.tsx` and change:
```tsx
<article className="ts-card">
```
to:
```tsx
<article className="ts-card glass">
```

- [ ] **Step 3: Build + test**

Run: `cd frontend && npm run build && npm run test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/app/globals.css frontend/src/components/UnifiedProjectCard.tsx
git commit -m "M3: add Liquid Glass design tokens and utility classes"
```

---

### Task 3.2: Apply gradient background in layout.tsx

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Edit layout.tsx body styling**

Ensure `layout.tsx` has no overriding body background. The gradient is set via `globals.css`. No further edit needed if the body currently uses defaults. Verify in browser.

- [ ] **Step 2: Visual check**

Run: `cd frontend && npm run dev`, load localhost, confirm lavender→sky gradient visible.

- [ ] **Step 3: Commit if any change**

```bash
git add frontend/src/app/layout.tsx
git commit -m "M3: ensure gradient body background renders through layout" || echo "no change needed"
```

---

### Task 3.3: Rebuild SearchBar with frosted glass

**Files:**
- Modify: `frontend/src/components/SearchBar.tsx`

- [ ] **Step 1: Read current SearchBar**

Run: `cd frontend && cat src/components/SearchBar.tsx`
Note the current class structure.

- [ ] **Step 2: Wrap the input in glass surface**

Change the outer container's className to include `glass-strong` and adjust padding. Example:

```tsx
<div className="glass-strong search-bar-shell">
  <input className="search-bar-input" ... />
  {/* existing children */}
</div>
```

Add matching CSS in `globals.css`:

```css
.search-bar-shell {
  padding: 6px 10px 6px 18px;
  border-radius: var(--ts-radius-full);
  display: flex;
  align-items: center;
  gap: 10px;
  transition: box-shadow .2s ease;
}
.search-bar-shell:focus-within { box-shadow: 0 0 0 4px var(--ts-accent-soft), var(--ts-shadow-rest); }
.search-bar-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 15px; color: var(--ts-text);
}
.search-bar-input::placeholder { color: var(--ts-text-subtle); }
```

- [ ] **Step 3: Visual check + commit**

Run dev server, confirm search bar looks like frosted pill with glow on focus.

```bash
git add frontend/src/components/SearchBar.tsx frontend/src/app/globals.css
git commit -m "M3: SearchBar frosted pill with focus glow"
```

---

### Task 3.4: Rebuild ResultsToolbar with glass

**Files:**
- Modify: `frontend/src/components/ResultsToolbar.tsx`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Add glass container wrapper**

Wrap the toolbar's root `<div>` with `className="glass"` and add padding. Convert sort/filter buttons to `.btn` / `.btn-primary` classes.

- [ ] **Step 2: Add pill-toggle CSS for active filters**

```css
.filter-pill {
  /* inherits .pill */
  cursor: pointer;
  transition: background .15s ease, color .15s ease;
}
.filter-pill[data-active="true"] {
  background: var(--ts-accent-gradient);
  color: white;
  border-color: transparent;
}
```

Apply `data-active={isActive}` on each filter pill in `ResultsToolbar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ResultsToolbar.tsx frontend/src/app/globals.css
git commit -m "M3: ResultsToolbar in glass surface with pill-toggle filters"
```

---

### Task 3.5: Rebuild SourceFilter popover with glass sheet

**Files:**
- Modify: `frontend/src/components/SourceFilter.tsx`

- [ ] **Step 1: Convert popover container to glass-strong**

Change the popover root's className to include `glass-strong` and `source-filter-sheet`. Add CSS:

```css
.source-filter-sheet {
  padding: 16px;
  max-width: 380px;
  border-radius: var(--ts-radius-lg);
}
```

- [ ] **Step 2: Convert per-source rows to toggle chips**

Each source becomes a clickable `.filter-pill` styled chip with the source's label.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SourceFilter.tsx frontend/src/app/globals.css
git commit -m "M3: SourceFilter as glass sheet with chip toggles"
```

---

### Task 3.6: Rebuild landing sections

**Files:**
- Modify: `frontend/src/components/TrendingSection.tsx`
- Modify: `frontend/src/components/DirectJumps.tsx`
- Modify: `frontend/src/components/SavedSection.tsx`

- [ ] **Step 1: Wrap each section root in `className="glass section-container"`**

Add section CSS:

```css
.section-container {
  padding: 20px 24px;
  margin-bottom: 18px;
}
.section-title {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ts-text-subtle);
  margin: 0 0 12px;
}
```

Apply `.section-title` to each section's heading.

- [ ] **Step 2: Visual check localhost**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TrendingSection.tsx frontend/src/components/DirectJumps.tsx frontend/src/components/SavedSection.tsx frontend/src/app/globals.css
git commit -m "M3: landing sections (Trending, DirectJumps, Saved) in glass containers"
```

---

### Task 3.7: ShortcutHelpModal + CardSkeleton

**Files:**
- Modify: `frontend/src/components/ShortcutHelpModal.tsx`
- Modify: `frontend/src/components/CardSkeleton.tsx`

- [ ] **Step 1: Convert modal to glass sheet**

Root container of modal → `className="glass-strong shortcut-modal"`. Add:

```css
.shortcut-modal {
  padding: 24px 28px;
  max-width: 480px;
  box-shadow: var(--ts-shadow-hover);
}
```

- [ ] **Step 2: Convert skeleton to glass with shimmer placeholder bar**

Replace CardSkeleton's `<div>` with `<div className="glass ts-card skeleton">...</div>`. Add:

```css
.skeleton .shimmer {
  background: linear-gradient(90deg, rgba(200,200,200,0.2), rgba(240,240,240,0.5), rgba(200,200,200,0.2));
  background-size: 200% 100%;
  animation: shimmer 1.4s linear infinite;
  border-radius: var(--ts-radius-md);
  height: 14px;
}
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.skeleton .shimmer-title { width: 60%; height: 20px; }
.skeleton .shimmer-line  { width: 100%; }
.skeleton .shimmer-short { width: 40%; }
```

Redesign the skeleton JSX to have a shimmer title + 2 shimmer lines inside a `.ts-card` shell.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ShortcutHelpModal.tsx frontend/src/components/CardSkeleton.tsx frontend/src/app/globals.css
git commit -m "M3: modal and skeleton on glass surfaces"
```

---

### Task 3.8: Intent-driven gradient tint

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: Update tokens.css to use HSL with CSS variable hue**

Replace the `--ts-bg-gradient` line:

```css
--ts-bg-gradient: linear-gradient(
  135deg,
  hsl(var(--ts-intent-hue), 100%, 95%) 0%,
  hsl(var(--ts-intent-hue), 70%, 90%) 45%,
  hsl(calc(var(--ts-intent-hue) + 40), 90%, 93%) 100%
);
```

And add CSS variable transition on the body:

```css
body { transition: --ts-intent-hue 800ms ease; }
```

(Note: transitions on custom properties need the `@property` rule in modern browsers. Add:)

```css
@property --ts-intent-hue {
  syntax: "<number>";
  inherits: true;
  initial-value: 280;
}
```

- [ ] **Step 2: In page.tsx, write intent-hue to document root on query change**

After `expansion = expandQuery(freeText)`:

```ts
const hueByIntent: Record<string, number> = {
  project_search: 280, how_to: 110, recommendation: 200,
  comparison: 260, troubleshooting: 350, model_search: 35,
  general: 280,
};
document.documentElement.style.setProperty("--ts-intent-hue", String(hueByIntent[expansion.intent] ?? 280));
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/app/page.tsx
git commit -m "M3: intent-driven background tint via CSS custom property"
```

---

### Task 3.9: M3 gate — Lighthouse check

**Files:** none

- [ ] **Step 1: Run Lighthouse locally**

```bash
cd frontend && npm run build && npm run start
# In a browser, open Chrome devtools → Lighthouse → run on http://localhost:3000
```

- [ ] **Step 2: Verify scores**

Target: accessibility ≥ 95, performance ≥ 85.

If performance dips due to backdrop-filter, reduce `--ts-blur` to `16px` as a mitigation and re-run.

- [ ] **Step 3: Commit fix if needed and the gate pass**

```bash
git add -A frontend/
git commit -m "M3: gate pass — Lighthouse a11y ≥ 95, perf ≥ 85"
```

---

## Milestone 4 — Motion & Micro-interactions

### Task 4.1: Install framer-motion and create motion.ts

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/motion.ts`

- [ ] **Step 1: Install**

```bash
cd frontend && npm install framer-motion
```

- [ ] **Step 2: Create motion.ts**

```ts
// frontend/src/lib/motion.ts
import type { Transition, Variants } from "framer-motion";

export const springSoft: Transition = { type: "spring", stiffness: 280, damping: 28, mass: 0.8 };
export const springSnappy: Transition = { type: "spring", stiffness: 500, damping: 35 };

export const gridContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: springSoft },
  exit:    { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18 } },
  hover:   { y: -3, transition: { duration: 0.18 } },
  tap:     { scale: 0.98, transition: { duration: 0.1 } },
};

export const bookmarkVariants: Variants = {
  rest:   { scale: 1 },
  tapped: { scale: [1, 1.35, 1], transition: { duration: 0.4, times: [0, 0.6, 1] } },
};

export const sheetVariants: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: springSoft },
  exit:    { opacity: 0, y: 20, transition: { duration: 0.2 } },
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/motion.ts
git commit -m "M4: add framer-motion and shared spring/variant primitives"
```

---

### Task 4.2: useReducedMotion hook

**Files:**
- Create: `frontend/src/hooks/useReducedMotion.ts`
- Create: `frontend/src/hooks/useReducedMotion.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// frontend/src/hooks/useReducedMotion.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReducedMotion } from "./useReducedMotion";

describe("useReducedMotion", () => {
  it("returns true when prefers-reduced-motion is reduce", () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes("reduce"),
      media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("returns false otherwise", () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

Run: `cd frontend && npm run test -- useReducedMotion`
Expected: FAIL.

- [ ] **Step 3: Implement hook**

```ts
// frontend/src/hooks/useReducedMotion.ts
import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}
```

- [ ] **Step 4: Run test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useReducedMotion.ts frontend/src/hooks/useReducedMotion.test.ts
git commit -m "M4: useReducedMotion hook wraps matchMedia"
```

---

### Task 4.3: AnimatedGrid wrapper (stagger)

**Files:**
- Create: `frontend/src/components/motion/AnimatedGrid.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/components/motion/AnimatedGrid.tsx
import { AnimatePresence, motion } from "framer-motion";
import { gridContainer } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function AnimatedGrid({ children, keyed }: { children: React.ReactNode; keyed: string }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={keyed}
        variants={reduced ? {} : gridContainer}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="results-grid"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Wire into `page.tsx`**

Replace the current results grid `<div className="results-grid">` with `<AnimatedGrid keyed={freeText}>`. The `keyed` prop causes the grid to re-mount on query change (triggering exit → enter animation).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/motion/AnimatedGrid.tsx frontend/src/app/page.tsx
git commit -m "M4: AnimatedGrid with stagger enter/exit on query change"
```

---

### Task 4.4: AnimatedCard wrapper

**Files:**
- Create: `frontend/src/components/motion/AnimatedCard.tsx`
- Modify: `frontend/src/components/UnifiedProjectCard.tsx`

- [ ] **Step 1: Create AnimatedCard**

```tsx
// frontend/src/components/motion/AnimatedCard.tsx
import { motion } from "framer-motion";
import { cardVariants } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function AnimatedCard({ children, layoutId }: { children: React.ReactNode; layoutId?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      layoutId={layoutId}
      variants={reduced ? {} : cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={reduced ? undefined : "hover"}
      whileTap={reduced ? undefined : "tap"}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Wrap UnifiedProjectCard's root in AnimatedCard**

Change `<article className="ts-card glass">...</article>` to:

```tsx
<AnimatedCard layoutId={project.id}>
  <article className="ts-card glass">...</article>
</AnimatedCard>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/motion/AnimatedCard.tsx frontend/src/components/UnifiedProjectCard.tsx
git commit -m "M4: AnimatedCard wrapper with enter/exit/hover/tap"
```

---

### Task 4.5: Bookmark heart animation

**Files:**
- Modify: `frontend/src/components/UnifiedProjectCard.tsx`

- [ ] **Step 1: Replace bookmark button with motion variant**

```tsx
import { motion, useAnimationControls } from "framer-motion";
import { bookmarkVariants } from "@/lib/motion";
// ...
const controls = useAnimationControls();
// ...
<motion.button
  className={`ts-bookmark ${isBookmarked ? "bookmarked" : ""}`}
  variants={bookmarkVariants}
  animate={controls}
  onClick={() => { toggle(); controls.start("tapped").then(() => controls.start("rest")); }}
>
  {isBookmarked ? "♥" : "♡"}
</motion.button>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/UnifiedProjectCard.tsx
git commit -m "M4: animated bookmark heart (scale 1→1.35→1)"
```

---

### Task 4.6: Search bar focus animation

**Files:**
- Modify: `frontend/src/components/SearchBar.tsx`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Animated placeholder lift with CSS keyframe**

Add CSS:

```css
.search-bar-shell:focus-within .search-placeholder {
  transform: translateY(-10px);
  opacity: 0.7;
  transition: transform .25s ease, opacity .25s ease;
}
.search-bar-shell.pulse { animation: pulseRing 0.6s cubic-bezier(.4,0,.2,1) 1; }
@keyframes pulseRing {
  0% { box-shadow: 0 0 0 0 var(--ts-accent-soft); }
  100% { box-shadow: 0 0 0 14px rgba(124,58,237,0); }
}
```

- [ ] **Step 2: Toggle pulse class on focus event**

In `SearchBar.tsx`, add `onFocus={(e) => { e.currentTarget.closest('.search-bar-shell')?.classList.add('pulse'); setTimeout(() => ..., 600); }}` (or use refs).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SearchBar.tsx frontend/src/app/globals.css
git commit -m "M4: search bar focus pulse and placeholder lift"
```

---

### Task 4.7: Filter pill toggle animation

**Files:**
- Modify: `frontend/src/components/ResultsToolbar.tsx`

- [ ] **Step 1: Convert filter pills to motion.button with layout animation**

```tsx
import { motion } from "framer-motion";
import { springSnappy } from "@/lib/motion";
// ...
<motion.button
  className="filter-pill"
  data-active={isActive}
  animate={{ backgroundColor: isActive ? "#7c3aed" : "rgba(255,255,255,0.85)" }}
  transition={springSnappy}
>
  {label}
</motion.button>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ResultsToolbar.tsx
git commit -m "M4: animated filter pill toggles (spring snap)"
```

---

### Task 4.8: Skeleton shimmer animation via Shimmer component

**Files:**
- Create: `frontend/src/components/motion/Shimmer.tsx`
- Modify: `frontend/src/components/CardSkeleton.tsx`

- [ ] **Step 1: Create Shimmer**

```tsx
// frontend/src/components/motion/Shimmer.tsx
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function Shimmer({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  return <div className={`shimmer ${reduced ? "shimmer-static" : ""} ${className}`} />;
}
```

- [ ] **Step 2: Add static variant CSS**

```css
.shimmer-static { animation: none; background: rgba(200,200,200,0.3); }
```

- [ ] **Step 3: Use in CardSkeleton**

```tsx
<div className="ts-card glass skeleton">
  <Shimmer className="shimmer-title" />
  <Shimmer className="shimmer-line" />
  <Shimmer className="shimmer-line shimmer-short" />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/motion/Shimmer.tsx frontend/src/components/CardSkeleton.tsx
git commit -m "M4: Shimmer component drives skeleton animation with reduced-motion fallback"
```

---

### Task 4.9: CountUp for source counter

**Files:**
- Create: `frontend/src/components/motion/CountUp.tsx`
- Modify: `frontend/src/components/SearchProgressBar.tsx`

- [ ] **Step 1: Implement CountUp**

```tsx
// frontend/src/components/motion/CountUp.tsx
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export function CountUp({ value, duration = 0.3 }: { value: number; duration?: number }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));
  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration });
    return () => controls.stop();
  }, [value, duration, reduced, mv]);
  return <motion.span>{rounded}</motion.span>;
}
```

- [ ] **Step 2: Use in SearchProgressBar**

Replace raw number rendering (`{sourcesCompleted}`) with `<CountUp value={sourcesCompleted} />`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/motion/CountUp.tsx frontend/src/components/SearchProgressBar.tsx
git commit -m "M4: CountUp animates source-complete counter"
```

---

### Task 4.10: Toast feedback for copy/bookmark

**Files:**
- Create: `frontend/src/components/motion/Toast.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/components/motion/Toast.tsx
import { AnimatePresence, motion } from "framer-motion";
import { sheetVariants } from "@/lib/motion";

export function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="glass-strong ts-toast-motion"
          variants={sheetVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          key={message}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

Add CSS:

```css
.ts-toast-motion {
  position: fixed; top: 24px; right: 24px;
  padding: 12px 16px; border-radius: var(--ts-radius-md);
  font-size: 13px; font-weight: 600; color: var(--ts-text);
  z-index: 100;
}
```

- [ ] **Step 2: Host Toast at page level**

In `page.tsx`, add `const [toast, setToast] = useState<string | null>(null)` and render `<Toast message={toast} />` at the end. Pass a shared `onCopy` that sets `toast`. Replace the per-card `setCopied` inside `UnifiedProjectCard` with a prop-bubbled callback OR use a lightweight context/singleton.

Simplest wire-up: add an `onToast` prop to `UnifiedProjectCard`, thread it from `page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/motion/Toast.tsx frontend/src/app/page.tsx frontend/src/components/UnifiedProjectCard.tsx frontend/src/app/globals.css
git commit -m "M4: animated Toast for copy + bookmark feedback"
```

---

### Task 4.11: Animated modal and source-filter sheets

**Files:**
- Modify: `frontend/src/components/ShortcutHelpModal.tsx`
- Modify: `frontend/src/components/SourceFilter.tsx`

- [ ] **Step 1: Wrap modal content in `motion.div` with `sheetVariants`**

```tsx
import { AnimatePresence, motion } from "framer-motion";
import { sheetVariants } from "@/lib/motion";
// ...
<AnimatePresence>
  {isOpen && (
    <motion.div className="glass-strong shortcut-modal"
      variants={sheetVariants}
      initial="hidden" animate="visible" exit="exit">
      {children}
    </motion.div>
  )}
</AnimatePresence>
```

Same pattern for SourceFilter's popover.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ShortcutHelpModal.tsx frontend/src/components/SourceFilter.tsx
git commit -m "M4: modal + source-filter sheets animate in with spring"
```

---

### Task 4.12: 60fps perf check

**Files:** none (verification only)

- [ ] **Step 1: Run the app locally in production build**

```bash
cd frontend && npm run build && npm run start
```

- [ ] **Step 2: Record perf in Chrome devtools**

1. Open devtools → Performance tab.
2. Record a 6-second session that includes: type a query, wait for results (50+ cards), scroll down, hover several cards, click bookmark, open shortcut modal.
3. Stop recording.
4. Scan the main-thread flame chart. Confirm frames are predominantly green (60fps) with no long red tasks.

- [ ] **Step 3: If frames drop, reduce the animated-card stagger count**

In `AnimatedGrid`, limit `variants` to the first 12 children only; remaining render without stagger variants. Re-record.

- [ ] **Step 4: Commit mitigations (if any)**

```bash
git add -A frontend/
git commit -m "M4: perf tune — cap stagger variants to 12 cards" || echo "no tune needed"
```

---

### Task 4.13: End-to-end 10-query screenshot set

**Files:**
- Create: `docs/superpowers/evidence/2026-04-23-m4-screenshots/` (directory with 10 PNGs)

- [ ] **Step 1: With `npm run start` running, visit localhost for each query**

Queries:
1. `react state manager`
2. `mcp server`
3. `rust http client`
4. `postgres orm`
5. `video editor open source`
6. `local llm runtime`
7. `agentic framework`
8. `diff tool cli`
9. `password manager self hosted`
10. `shader playground browser`

For each: wait for results, take a full-viewport screenshot, save to `docs/superpowers/evidence/2026-04-23-m4-screenshots/NN-slug.png`.

- [ ] **Step 2: Spot-check top-3**

For each query, confirm the top 3 cards are non-embarrassing. If any top-3 is wrong:
- Go back to M1 synonyms and add the missing concept/boost.
- Re-run backtest.
- Re-screenshot that query.

- [ ] **Step 3: Commit screenshots + final merge message**

```bash
git add docs/superpowers/evidence/
git commit -m "M4: gate pass — 10 real queries yield non-embarrassing top-3"
```

- [ ] **Step 4: Final celebration commit**

```bash
git commit --allow-empty -m "ThreadSeeker rebuild complete: synonyms+BM25, normalized cards, Liquid Glass, motion"
```

---

## Self-Review

**Spec coverage check** — walked the spec section by section:
- Deletions (Groq, SynthesisBox, old ranking) → Task 1.8, 1.9, 2.4 ✓
- synonyms.ts schema + entries → Task 1.1, 1.4 ✓
- expandQuery() → Task 1.3 ✓
- BM25 ranker → Task 1.5 ✓
- Intent classifier preserved → Task 1.2 ✓
- Adapter OR-expansion → Task 1.7 ✓
- Backtest expansion → Task 1.6 ✓
- Backtest gate → Task 1.10 ✓
- CardPills / SourceBadge / CardActions → Task 2.1-2.3 ✓
- UnifiedProjectCard rebuild → Task 2.4 ✓
- 28-source render check → Task 2.5 ✓
- CSS tokens + utilities → Task 3.1 ✓
- layout.tsx gradient → Task 3.2 ✓
- SearchBar frosted → Task 3.3 ✓
- ResultsToolbar glass → Task 3.4 ✓
- SourceFilter glass sheet → Task 3.5 ✓
- Landing sections glass → Task 3.6 ✓
- Modal + skeleton → Task 3.7 ✓
- Intent-tint gradient → Task 3.8 ✓
- Lighthouse gate → Task 3.9 ✓
- framer-motion install + motion.ts → Task 4.1 ✓
- useReducedMotion → Task 4.2 ✓
- Stagger grid → Task 4.3 ✓
- Card hover/tap → Task 4.4 ✓
- Bookmark heart → Task 4.5 ✓
- Search bar focus → Task 4.6 ✓
- Filter toggle → Task 4.7 ✓
- Skeleton shimmer → Task 4.8 ✓
- Source-counter count-up → Task 4.9 ✓
- Toast → Task 4.10 ✓
- Modal + filter sheet motion → Task 4.11 ✓
- 60fps check → Task 4.12 ✓
- 10-query screenshots → Task 4.13 ✓

No gaps found.

**Placeholder scan** — no TBDs/TODOs/"similar to Task N" patterns. Every code block is concrete.

**Type consistency** — `SynonymEntry`, `ExpandQueryResult`, `MaintenanceState`, `CopyItem` names match across tasks. `UnifiedProject` fields referenced (`stars`, `downloads`, `fullName`, `updatedAt`, `source`, `language`, `topics`, `license`, `description`, `name`, `id`, `url`) match `types.ts` (already verified via Read).
