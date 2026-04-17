# ThreadSeeker

**A unified search engine for the open-source world.** One query, 24 sources,
zero paid APIs.

ThreadSeeker searches GitHub, Hugging Face, GitLab, Codeberg, npm, PyPI,
crates.io, Packagist, RubyGems, JSR, conda-forge, Docker Hub, Flathub,
Homebrew, F-Droid, AUR, Open VSX, Papers with Code, arXiv, Hacker News,
Reddit, Lobsters, Stack Overflow, and Dev.to in parallel, then lets you
copy the install/clone command — right from the result card.

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
│  Streaming results │         │  Packagist, RubyGems, HN,    │
│  Query highlighter │         │  Dev.to, JSR                 │
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
│  - /api/search-homebrew        │  Homebrew (no search endpoint)
│  - /api/search-fdroid          │  F-Droid (no search endpoint)
│  - /api/search-arxiv           │  arXiv (Atom XML)
│  - /api/proxy                  │  CORS proxy (Docker, Flathub,
│                                │   Lobsters, SO, Papers with Code)
└────────────────────────────────┘
```

Most sources talk to the browser directly. The Pages Functions handle the
CORS-blocked ones, the two registries with no search API (Homebrew, F-Droid),
and the AI summarization.

All Groq calls are edge-cached via the Cloudflare Cache API (24 h for query
optimization, 1 h for synthesis) so repeat queries are instant.

---

## Features

- **24 sources**, single unified card UI.
- **Streaming results** — the skeleton disappears the moment the first
  source returns; remaining sources stream in behind it.
- **Cross-source dedup** — the same project surfaced on GitHub + PyPI +
  Docker Hub folds into one card with "Also on" chips linking to each
  secondary platform.
- **Query highlighting** — matched terms are `<mark>`-highlighted in
  every card's name and description.
- **Per-source install actions** — copy-to-clipboard for `git clone`,
  `npm install`, `pip install`, `cargo add`, `composer require`,
  `gem install`, `deno add jsr:…`, `docker pull`, `flatpak install`,
  `brew install`, and more.
- **AI query optimization** — your natural-language query becomes three
  per-platform optimized queries (GitHub-style, Hugging Face tag-style,
  Reddit-style) with intent classification.
- **Cross-source synthesis** — a single AI-written verdict of the
  unified result set (repos vs. models vs. packages vs. community).
- **Intent-aware ranking** — query containing a language keyword
  (`python`, `rust`, `react`, …) boosts projects in the matching
  ecosystem; abandoned low-signal repos are penalized.
- **Thread-aware cards** — Reddit / HN / Lobsters / Stack Overflow /
  Dev.to / arXiv / Papers with Code render as discussion cards with
  sentiment badges and comment counts.

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
    app/              Next.js 14 App Router
    components/       SearchBar, UnifiedProjectCard, ResultsToolbar, …
    lib/
      sources.ts      All 21 source adapters + ranking + dedup
      actions.ts      Per-source install/copy commands
      api-client.ts   Calls to Pages Functions
      utils.ts        Query highlighter, time formatting
  functions/
    _shared/groq.ts   Groq client + edge cache helper
    api/              Pages Functions (see architecture diagram)
docs/                 DEPLOY.md
```

---

## License

See [LICENSE](LICENSE).
