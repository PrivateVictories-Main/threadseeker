# ThreadSeeker UI Upgrade & Search-Quality Rebuild

**Date:** 2026-04-23
**Author:** Ryan + Claude (brainstorming session)
**Status:** Design approved, ready for implementation planning

## Problem

ThreadSeeker's current experience has four compounding problems:

1. **Search relevance is not intent-aware enough.** Results come from 28 sources but the ranker is a hand-tuned heuristic sum with no concept/synonym understanding. Newer terminology ("MCP servers", "agentic framework") routinely misses canonical projects.
2. **UI feels static.** No motion language, no transitions, no feedback loops — the app looks correct but feels dead.
3. **Search flow feels slow.** Perceived latency dominates because nothing animates while results stream in.
4. **Cards are inconsistent.** Info density, height, hierarchy, action layout, and visual source-typing all vary by source, producing a janky grid.

## Non-Goals

- No LLM dependency (removes existing optional Groq integration entirely).
- No client-side model download (no transformers.js, no ONNX, no embeddings).
- No deployment changes. ThreadSeeker remains local-only (`wrangler pages dev`). No `git push` to origin, no Cloudflare Pages deploy, no VPS.
- No new API keys, no new paid services, no new infrastructure.
- No dark-mode variant in this pass (deferred).

## Constraints

- Zero ongoing cost. Zero API keys required at runtime.
- Free public APIs only (current 28 sources stay).
- Development happens on localhost via `wrangler pages dev` (or `npm run dev` for UI-only iteration).
- Respect `prefers-reduced-motion`.
- Must not regress the existing 12-test vitest suite.
- Must maintain or improve the 30-query backtest baseline (P@3 90%, MRR 0.74).

## Architecture Overview

Bones unchanged: Next.js 14 static export + Cloudflare Pages Functions at `/api/*`. All changes are inside `frontend/`. The architectural diff is subtractive (delete Groq code) plus two new library modules (synonyms, BM25) plus a visual/motion layer rebuild.

```
frontend/
├── src/
│   ├── app/page.tsx                    # Orchestrator — loses Groq calls, gains synonym expansion
│   ├── components/                     # Rebuilt card + new motion primitives
│   ├── lib/
│   │   ├── sources/
│   │   │   ├── synonyms.ts             # NEW — concept/alias dictionary
│   │   │   ├── ranking-bm25.ts         # NEW — proper BM25 replacing ranking.ts
│   │   │   ├── ranking.ts              # DELETE after migration
│   │   │   ├── adapters.ts             # Minor edit — use expandQuery() output
│   │   │   └── ...                     # Unchanged
│   │   └── motion.ts                   # NEW — shared spring presets, variants
│   └── app/globals.css                 # Rewritten — Liquid Glass tokens
└── functions/api/
    ├── optimize-queries.ts             # DELETE
    ├── synthesize.ts                   # DELETE
    ├── related-queries.ts              # DELETE
    ├── integrate.ts                    # DELETE
    ├── _shared/groq.ts                 # DELETE (or reduce to shared CORS helpers)
    └── proxy.ts, search-*.ts           # Kept — no LLM dependency
```

## Milestones

Four layered milestones. Each milestone ends in a working, committable state. No milestone is started until the previous one's gate passes.

### M1 — Synonyms + BM25 Ranker

**Goal:** Search understands intent and newer-meta terminology without an LLM.

**Deletions:**
- `frontend/functions/api/optimize-queries.ts`
- `frontend/functions/api/synthesize.ts`
- `frontend/functions/api/related-queries.ts`
- `frontend/functions/api/integrate.ts`
- `frontend/functions/api/_shared/groq.ts` (or reduce to unrelated helpers)
- All Groq-related imports in `page.tsx` and `api-client.ts`
- `GROQ_API_KEY` reference in docs
- Sparkles per-card AI integration button (M2 also removes it)
- `SynthesisBox.tsx` (Groq-generated summary) — strip usage, keep file commented if needed for M3 redesign

**New file: `frontend/src/lib/sources/synonyms.ts`**

Exports a `SYNONYMS` constant of concept entries. Each entry:

```ts
interface SynonymEntry {
  concept: string;                    // internal id, e.g. "react-state-management"
  triggers: string[];                 // substrings that activate this entry
  requires?: string[];                // if present, all must also appear in query
  expandTo: string[];                 // terms OR-ed into fetch queries
  boostProjects?: string[];           // "owner/repo" fingerprints guaranteed a boost
}
```

Launch with ~50 entries covering: React state, Vue state, Rust async, Python web, ORMs, HTTP clients, MCP servers, agentic frameworks, vector DBs, LLM observability, edge runtimes, bundlers, CSS-in-JS, auth libraries, queue/pubsub, testing frameworks, shader languages, WebGPU, local-first DBs, image generation, video pipelines, zero-config tooling, deploy platforms, log aggregators, markdown toolchains, terminal emulators, etc.

Exports `expandQuery(query: string): { expandedTerms: string[]; boostFullNames: string[]; intent: Intent }`.

**New file: `frontend/src/lib/sources/ranking-bm25.ts`**

Replaces `ranking.ts`. Exports `rankCorpus(projects: UnifiedProject[], query: string, expansion: ExpandQueryResult): UnifiedProject[]`.

Algorithm:

1. Build corpus doc per project: `[name, description, topics, language].join(' ')` (lowercased, tokenized).
2. Compute IDF over the result corpus (not the whole web — this is a re-ranker).
3. Score each doc via BM25 (k1=1.2, b=0.75) against:
   - User's raw query tokens (weight 1.0)
   - Expanded synonyms (weight 0.5)
4. Combine BM25 score with non-lexical factors:
   - `log10(stars + 1)` scaled (capped at 3500)
   - Recency bonus/penalty (same buckets as current code)
   - Source baseline bonus (same table as current code)
   - License bucket signal (permissive slightly preferred)
   - `+2000` fixed lift if `project.fullName` appears in `boostFullNames`
5. Intent weights from `classifyIntent()` adjust per-source contribution.

Old `ranking.ts` gets deleted once BM25 ranker passes the backtest.

**Query-fetch integration (`adapters.ts` touch):**

`page.tsx` calls `expandQuery(userInput)` client-side (synonyms are shipped in the static bundle). Passes `expandedTerms` to each adapter. Adapters that support OR (GitHub, npm, etc.) OR together the top 3-5 expansions. Adapters that don't, parallel-fetch raw and top-1 expansion, merge.

**Backtest harness expansion (`tests/backtest/queries.ts`):**

30 → ~80 queries. Adds newer-meta queries:
- "mcp server for postgres"
- "agentic framework 2026"
- "local llm runtime"
- "vector database self-hosted"
- "rust web framework"
- "svelte state management"
- "shader playground browser"
- "terminal emulator gpu"
- "markdown rich editor"
- "observability for llm apps"
(plus 40 more covering existing and newer domains)

**M1 success gate:**
- Backtest: P@3 ≥ 92%, MRR ≥ 0.78, winner-at-#1 ≥ 82%.
- All existing 12 vitest unit tests pass.
- ≥ 6 new unit tests for `expandQuery()` and BM25 scoring.
- Manual spot-check 10 queries: every top-3 is "not embarrassing."
- Zero runtime calls to Groq (verified by grep).

### M2 — Normalized Card Component

**Goal:** Every source renders identically-shaped cards with predictable info density and actions.

**Rebuild:** `frontend/src/components/UnifiedProjectCard.tsx` (currently 542 lines → target ≤ 250 after the rebuild).

**Invariants per card:**
- Source badge (top-left): vendor-matched gradient + name (GitHub=graphite, HF=orange, arXiv=red, crates=amber, reddit=tangerine, npm=crimson, pypi=indigo, stackoverflow=orange, etc.)
- Bookmark button (top-right): consistent position, heart icon, `Bookmark` state from existing hook
- Title row: `project.name` + optional sub (`by owner` or `1.41.0` version) at 12px in muted purple
- Description: 2-line clamp via `-webkit-line-clamp`, min-height reserved so empty-desc doesn't collapse
- Meta pill row: always 4 pills
  - Popularity (stars or downloads, formatted `★ 45.2k` / `↓ 1.2M` / `↗ Cited 180×`)
  - Language or type (`TypeScript`, `Rust`, `LLM · 7B`, `cs.CL`)
  - License bucket (`MIT`, `Apache-2.0`, `GPL-3.0`, `Proprietary`, `Unknown`) — recycled from existing license helper
  - Maintenance state (`● Active` / `● Stale` / `● Abandoned` / `● Recent`)
- Action row: `Open →` primary + 1-2 copy-install buttons (source-specific: `cargo add`, `npm i`, `pip install`, `gh clone`, `Cite`)
- Fixed `min-height: 204px` on the card; card uses `display: flex; flex-direction: column` so action row stays bottom-aligned.

**New helper: `frontend/src/components/card/CardPills.tsx`**

Pure component receives `{ popularity, language, license, maintenance }` and renders the pill row. Keeps UnifiedProjectCard cleaner.

**Deletions:**
- Sparkles integration button and its handler (no more Groq).
- Per-source ad-hoc markup paths inside UnifiedProjectCard.
- MCP-snippet block moves to an "Open in Claude" button inside the card's action row (no Groq, just static JSON template).

**M2 success gate:**
- Manual scroll of 50 mixed-source results — zero layout shift, zero missing pills, zero height jumps.
- Storybook-style page (or raw test page) showing one card from each of the 28 sources — all visually consistent.
- ≥ 4 new component tests for `CardPills` and `UnifiedProjectCard` source-variant rendering.

### M3 — Liquid Glass Visual System

**Goal:** The app looks like Arc / iOS 26 — frosted, soft-gradient, tactile, distinctly "ThreadSeeker" and not generic web.

**New CSS tokens in `globals.css`:**

```css
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

  --ts-radius-lg: 16px;  /* cards */
  --ts-radius-md: 12px;  /* pills, panels */
  --ts-radius-sm: 8px;   /* buttons */
  --ts-radius-full: 999px; /* status chips */

  --ts-shadow-rest: 0 8px 32px rgba(80, 50, 150, 0.10);
  --ts-shadow-hover: 0 14px 40px rgba(80, 50, 150, 0.18);
  --ts-shadow-card-selected: 0 0 0 4px rgba(124, 58, 237, 0.18), var(--ts-shadow-hover);

  --ts-blur: 24px;
}
```

**Touch points:**
- `app/layout.tsx`: body background becomes `var(--ts-bg-gradient)`, fixed, with optional subtle grain SVG overlay.
- `app/globals.css`: Define tokens, utility classes `.glass`, `.glass-strong`, `.pill`, `.btn-primary`, `.btn-ghost`.
- `SearchBar.tsx`: frosted glass container, integrated search-progress bar beneath, subtle inner glow on focus.
- `TrendingSection.tsx`, `DirectJumps.tsx`, `SavedSection.tsx`: all rebuilt against glass surfaces.
- `ResultsToolbar.tsx`: filter chips rebuilt as pill-shaped toggles with spring-animated "active" state.
- `SourceFilter.tsx`: sheet/popover with backdrop blur, per-source toggle checkboxes.

**Query-intent color tint:**
When `classifyIntent()` returns `model_search`, the body gradient's middle stop shifts toward amber; `how_to` shifts toward sage; `troubleshooting` shifts toward rose. Transition is 800ms cubic-bezier. This is barely perceptible but gives the app "character."

**M3 success gate:**
- Visual QA: every page surface (landing, loading, results, empty-state, error) matches the Arc/Liquid Glass aesthetic.
- Lighthouse local: accessibility ≥ 95, performance ≥ 85.
- Firefox + Safari + Chrome render consistently (backdrop-filter supported in all modern browsers; graceful degradation to solid white for older ones).

### M4 — Motion & Micro-interactions

**Goal:** The app *feels* alive. Every state change has a reason to animate.

**New file: `frontend/src/lib/motion.ts`**

Exports shared Framer Motion primitives:

```ts
export const springSoft = { type: "spring", stiffness: 280, damping: 28, mass: 0.8 };
export const springSnappy = { type: "spring", stiffness: 500, damping: 35 };

export const cardVariants = { ... };     // enter/exit stagger
export const pillTapVariants = { ... };  // on-click feedback
export const bookmarkVariants = { ... }; // heart scale + fill
export const shimmerVariants = { ... };  // skeleton sweep
```

**Animation catalog (all use Framer Motion, all share springs):**

| Where | What | Timing |
|-------|------|--------|
| Results grid | Stagger fade-up, 40ms per index, max 8 animated | `springSoft` |
| Card hover | `y: -3px` + shadow bloom | 250ms cubic-bezier |
| Card click | Subtle scale 0.98 then release | `springSnappy` |
| Bookmark | Heart scale 1→1.35→1, fill gradient | 400ms |
| Search bar focus | Placeholder slides up, ring pulses once | 600ms |
| Source filter toggle | Pill fills with accent + checkmark | `springSnappy` |
| Result reveal | Skeleton → real card crossfade at same grid position | 200ms |
| No-results | Illustration fades in with soft bob | 800ms |
| Source-counter | Number counts up as each source returns | 300ms per source |
| Intent tint shift | Body gradient hue lerps based on intent | 800ms |
| Skeleton shimmer | Linear-gradient sweep left→right | 1.4s loop |
| Filter change | Exiting cards scale-down-fade, new cards stagger in | 180ms + `springSoft` |
| Modal / help | Frosted sheet slides up from bottom with backdrop blur | `springSoft` |
| Toast feedback (copy, bookmark) | Slides in from top-right, auto-dismiss | `springSoft`, 2.5s dismiss |
| Tab / section switch | Content crossfade, not hard swap | 200ms |

**`prefers-reduced-motion`:** All springs resolve to instant; fades become opacity 0→1 with no transform; shimmer animations disable.

**M4 success gate:**
- 60fps on localhost Chrome devtools perf tab during a 50-result scroll.
- End-to-end manual test: 10 real queries (listed below), screenshots attached to final commit.
  1. "react state manager"
  2. "mcp server"
  3. "rust http client"
  4. "postgres orm"
  5. "video editor open source"
  6. "local llm runtime"
  7. "agentic framework"
  8. "diff tool cli"
  9. "password manager self-hosted"
  10. "shader playground browser"
- Reduced-motion preference respected (flip in devtools, verify no animation plays).

## Data Flow (end-to-end after M1-M4)

1. User types `react state manager` in `SearchBar.tsx`.
2. `expandQuery()` runs client-side: detects `react-state-management` concept; emits `expandedTerms = [zustand, jotai, redux, valtio, mobx, signals]`, `boostFullNames = [pmndrs/zustand, pmndrs/jotai]`, `intent = project_search`.
3. Parallel source fetches begin; each adapter uses expanded terms for query construction.
4. Skeleton cards render immediately in the results grid (M4 shimmer animation plays).
5. As each source returns, results stream into the grid with per-source counter animating up.
6. All results arrive → `rankCorpus()` scores via BM25, applies boosts, sorts.
7. Cards animate to final positions via stagger-fade-up.
8. Each card is a normalized `UnifiedProjectCard` with 4 pills and consistent actions.
9. User hovers → card lifts, bookmarks → heart animates, clicks "Open" → external link opens in new tab.

## Error Handling

- Network errors per source: source is marked "failed" in the counter, results grid shows what did return. No blocking error state unless all sources fail.
- Malformed synonym entries at build: TypeScript type on `SynonymEntry` catches most; add a unit test that validates every entry has `triggers.length > 0`.
- Reduced-motion: feature-detect with `window.matchMedia('(prefers-reduced-motion: reduce)')` at app mount, store in context, all motion primitives read from it.
- `backdrop-filter` unsupported (rare): fallback to `background: rgba(255,255,255,0.9)` via `@supports not (backdrop-filter: blur(1px))`.

## Testing Strategy

- **Unit (vitest):** ranking-bm25, expandQuery, card-pill formatters, motion reduced-motion detection.
- **Backtest:** ~80 queries with expected top-3 projects; gates are P@3 and MRR.
- **Manual:** visual QA pass on every surface; 10-query end-to-end with screenshots.
- **No e2e framework** (keeping the zero-dependency posture).

## Risks & Trade-offs

- **Synonym dictionary rot:** newer-meta terms emerge faster than commits. Mitigation: a brief `CONTRIBUTING-SYNONYMS.md` explaining the schema, plus a single commit ritual when opening a PR for new concepts.
- **BM25 tuning:** small corpus (~30 docs per query) makes IDF noisier than web-scale BM25. Mitigation: blend in global source-baseline and popularity signals as we do today.
- **`backdrop-filter` performance on low-end machines:** acceptable for local-only use. If we ever deploy, add a `prefers-reduced-transparency` fallback.
- **Groq deletion is irreversible in this branch:** synthesis box and related-queries sidebar lose content. Replacement for "related queries" is deferred — a static categorized-suggestion system could come later from the synonym dictionary itself.

## Out of Scope (future work)

- Dark mode.
- Mobile layout optimization (responsive works today but not polished).
- "Open in VS Code" / "Open in Cursor" deep-link actions.
- Personalized search history influencing ranking.
- A proper CLI companion (Level 3+ integration per the existing vision).

## Success Criteria (whole rebuild)

- All four milestone gates pass.
- Backtest: P@3 ≥ 92%, MRR ≥ 0.78.
- All 28 sources render via the normalized card.
- Groq grep returns zero runtime references.
- 10 end-to-end queries produce non-embarrassing top-3 results with screenshots attached.
- ThreadSeeker feels — Ryan's words — "extremely clean," with "some nice animations," and search that is "what you're searching for is what you're getting."
