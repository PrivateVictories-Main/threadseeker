# Contributing to ThreadSeeker

Thanks for considering a contribution! 🎉 ThreadSeeker is a single TypeScript
codebase — a Next.js static site plus a few Cloudflare Pages Functions. There is
**no backend service, no database, and no Python** to set up.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [The Quality Gate](#the-quality-gate)
- [Adding a New Source](#adding-a-new-source)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)

---

## Code of Conduct

This project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you're expected to uphold it. Be respectful, welcome newcomers, and
focus on what's best for the project.

---

## How Can I Contribute?

### Reporting Bugs
Check existing issues first. A good bug report has a clear title, exact reproduction
steps, the query you searched, what you expected vs. what you saw, your
OS + browser, and a screenshot if it's visual.

### Suggesting Enhancements
Open an issue describing the current behavior, the improvement, and why it's useful.
New **source adapters** are especially welcome — see below.

### Good First Issues
Look for the `good first issue` and `help wanted` labels.

---

## Development Setup

### Prerequisites
- **Node.js 22+**
- **git**

That's the whole list. (Optionally [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
to run the Pages Functions locally.)

### Setup

```bash
# 1. Fork, then clone your fork
git clone https://github.com/YOUR_USERNAME/threadseeker.git
cd threadseeker/frontend

# 2. Install
npm install

# 3. Run the dev server (direct-CORS sources work without any functions)
npm run dev            # http://localhost:3000

# 4. (optional) Run with the Pages Functions for the full source set
NEXT_OUTPUT=export npm run build
npx wrangler pages dev out   # http://localhost:8788
```

Everything lives under `frontend/`:

```
frontend/src/
  app/                  Next.js App Router (page.tsx, layout.tsx)
  components/           UI — SearchBar, UnifiedProjectCard, shell/, motion/, card/
  lib/
    sources/            the search engine:
      types.ts            shared shapes
      registry.ts         per-source display config + native search URLs
      adapters.ts         one function per upstream API
      index.ts            orchestrator (parallel fan-out, streaming)
      ranking-bm25.ts     cross-source BM25 re-ranker
      synonyms.ts         query-expansion dictionary
      intent.ts           regex intent classifier
      merge.ts            cross-platform de-duplication
      resilience.ts       query-relaxation chain
frontend/functions/api/   Cloudflare Pages Functions (Reddit, Homebrew, F-Droid,
                          arXiv, CORS proxy)
```

---

## The Quality Gate

CI runs the exact same checks on every push. Run them locally before opening a PR:

```bash
cd frontend
npm run lint           # ESLint (next lint)
npx tsc --noEmit       # type-check
npm run test           # vitest unit suite
npm run build          # static export build  (set NEXT_OUTPUT=export)
```

If you touched ranking, expansion, or adapters, also run the live-API search-quality
harness and make sure you didn't regress it:

```bash
npm run backtest       # precision@3 / MRR / winner-at-#1 + per-miss breakdown
```

---

## Adding a New Source

Sources must be **free** and reachable without a server we operate. A new adapter is
usually ~40 lines on the existing pattern:

1. Add the source key to `SourceType` in `src/lib/sources/types.ts`.
2. Add display config (name, icon, color, category) in `src/lib/sources/registry.ts`
   and a native search URL in `getSourceSearchUrl`.
3. Write `searchYourSource(query)` in `src/lib/sources/adapters.ts` returning the
   shared `SearchResult` shape. It must **never throw** — return empty on failure.
4. Wire it into the orchestrator in `src/lib/sources/index.ts`.
5. If the upstream blocks CORS, route it through `/api/proxy` (add the host to the
   allowlist in `functions/api/proxy.ts`); if it has no search API, add a dedicated
   Pages Function.
6. Add a copy/install command via `copyItemsForSource()` in
   `src/components/card/helpers.ts` if it makes sense.

---

## Pull Request Process

1. Branch from the working branch.
2. Add tests for new logic; keep the quality gate green.
3. Use [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat(scope): …`, `fix(scope): …`, `docs: …`).
4. Open the PR with a clear description of what changed and why.

---

## Style Guidelines

- **TypeScript** throughout; functional components with hooks.
- **Tailwind** utility classes; design tokens live in `src/styles/tokens.css` and
  `src/app/globals.css`. Mobile-first; honor `prefers-reduced-motion`.
- Match the surrounding code's naming, comment density, and idioms.
- Keep adapters defensive (never throw) and the result shape normalized.

---

**Thank you!** Your contributions keep ThreadSeeker useful for everyone searching
the open-source world. 💻
