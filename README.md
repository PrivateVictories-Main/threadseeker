# ThreadSeeker

**A unified search engine for the open-source world.** One query, 28 sources,
zero paid APIs.

ThreadSeeker searches GitHub, Hugging Face, GitLab, Codeberg, npm, PyPI,
crates.io, Maven Central, NuGet, Packagist, RubyGems, JSR, conda-forge,
Docker Hub, Flathub, Homebrew, F-Droid, AUR, Open VSX, WordPress, Papers
with Code, arXiv, Zenodo, Hacker News, Reddit, Lobsters, Stack Overflow,
and Dev.to in parallel, then lets you copy the install/clone command —
right from the result card.

It's built to be **free to run**: the whole app — frontend plus a handful of
serverless functions for the things the browser can't do — ships as a single
Cloudflare Pages deployment. No servers, no containers, no ongoing cost
beyond an (optional) custom domain.

---

## Architecture

```
┌────────────────────┐         ┌──────────────────────────────┐
│   Browser (SPA)    │ ──────► │  Public APIs (direct, CORS)  │
│                    │         │  GitHub, HF, npm, PyPI,      │
│  Next.js 14 SPA    │         │  GitLab, Codeberg, crates,   │
│  Streaming results │         │  Packagist, RubyGems, JSR,   │
│  Query highlighter │         │  Maven, NuGet, Zenodo, HN,   │
│  Bookmarks + saved │         │  Dev.to, AUR, Open VSX       │
└────────┬───────────┘         └──────────────────────────────┘
         │
         │  /api/*  (same-origin, same deployment)
         ▼
┌────────────────────────────────┐
│  Cloudflare Pages Functions    │
│                                │
│  - /api/search-reddit          │  Reddit + sentiment
│  - /api/optimize-queries       │  AI query → per-platform queries
│  - /api/synthesize             │  Cross-source AI verdict
│  - /api/related-queries        │  AI "you may also try" suggestions
│  - /api/integrate              │  AI "how do I use this?" snippet
│  - /api/search-homebrew        │  Homebrew (no search endpoint)
│  - /api/search-fdroid          │  F-Droid (no search endpoint)
│  - /api/search-arxiv           │  arXiv (Atom XML)
│  - /api/proxy                  │  CORS proxy (Docker, Flathub,
│                                │   WordPress, Lobsters, SO, PwC)
└────────────────────────────────┘
```

Most sources talk to the browser directly. The Pages Functions handle the
CORS-blocked ones, the two registries with no search API (Homebrew, F-Droid),
and the AI summarization.

All Groq calls are edge-cached via the Cloudflare Cache API (24h for query
optimization, integration snippets, and related queries; 1h for synthesis)
so repeat queries are instant and free.

---

## Features

- **28 sources**, single unified card UI.
- **Streaming results** — the skeleton disappears the moment the first
  source returns; remaining sources stream in behind it.
- **Cross-source dedup** — the same project surfaced on GitHub + PyPI +
  Docker Hub folds into one card with "Also on" chips linking to each
  secondary platform.
- **At-a-glance card meta** — every card surfaces the upstream-provided
  version, a license bucket (permissive / weak-copyleft / strong-copyleft),
  and a maintenance signal (active / stale / abandoned) so you can judge
  "should I use this?" without leaving the grid.
- **Query highlighting** — matched terms are `<mark>`-highlighted in
  every card's name and description.
- **Per-source install actions** — copy-to-clipboard for `git clone`,
  `npm install`, `pip install`, `cargo add`, `composer require`,
  `gem install`, `deno add jsr:…`, `docker pull`, `flatpak install`,
  `brew install`, `dotnet add package`, Gradle/Maven XML/sbt for Java,
  and more.
- **AI integration snippet** — per-card `Sparkles` button asks an LLM
  for "here's how to actually use this for what you searched" — tailored
  to the (query, project) pair.
- **MCP-server autodetection** — GitHub repos that look like MCP servers
  get a ready-to-paste `claude_desktop_config.json` snippet.
- **AI query optimization** — your natural-language query becomes three
  per-platform optimized queries (GitHub-style, Hugging Face tag-style,
  Reddit-style) with intent classification.
- **Cross-source synthesis** — a single AI-written verdict of the
  unified result set (repos vs. models vs. packages vs. community).
- **Intent-aware ranking** — query containing a language keyword
  (`python`, `rust`, `react`, `java`, `kotlin`, …) boosts projects in
  the matching ecosystem; obscure exact-name matches are dampened so
  canonical answers win multi-word concept queries; abandoned low-signal
  repos are penalized.
- **Thread-aware cards** — Reddit / HN / Lobsters / Stack Overflow /
  Dev.to / arXiv / Papers with Code render as discussion cards with
  sentiment badges and comment counts.
- **Bookmarks, related queries, README preview**, saved-section on the
  landing page, and shareable URL state (query + source filter + sort).

---

## Quality harness

Search quality is backed by a live-API harness under `frontend/scripts/` and
a unit suite:

```bash
cd frontend
npm run test        # vitest: ranking + merge tie-breakers, ~12 tests
npm run backtest    # 30 canonical queries, precision@3 / MRR / winner-at-#1
```

Current ranking baseline against the canonical set: **P@3 90 %, MRR 0.74,
ideal-winner-at-#1 80 %** with the backend disabled (no Groq query expansion).
The harness prints a per-category breakdown and lists every miss with the
expected vs. actual top hits so regressions during tuning are obvious.

---

## Quickstart

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full playbook. The short
version:

```bash
cd frontend
npm install
npm run dev                         # http://localhost:3000 (most sources work)

# ...or with Pages Functions locally:
NEXT_OUTPUT=export npm run build
GROQ_API_KEY=gsk_… wrangler pages dev out   # http://localhost:8788
```

Deploy: push to GitHub, connect the repo to Cloudflare Pages, set
`GROQ_API_KEY` as a Pages secret. Done.

---

## Repo layout

```
frontend/
  src/
    app/              Next.js 14 App Router (page.tsx, layout.tsx, error.tsx)
    components/       SearchBar, UnifiedProjectCard, CardMeta, ResultsToolbar, …
    lib/
      sources/        Modular source layer:
                        types.ts      shared shapes
                        registry.ts   per-source display config + search URLs
                        ranking.ts    cross-source relevance score
                        merge.ts      cross-platform dedup
                        adapters.ts   one function per upstream
                        index.ts      orchestrator + barrel re-exports
      actions.ts      Per-source install/copy commands
      api-client.ts   Calls to Pages Functions
      utils.ts        Query highlighter, time formatting
  functions/
    _shared/groq.ts   Groq client + edge cache helper
    api/              Pages Functions (see architecture diagram)
  scripts/
    backtest.ts       Search-quality harness
    backtest-queries.ts  Canonical query set
docs/                 DEPLOY.md
```

---

## License

See [LICENSE](LICENSE).
