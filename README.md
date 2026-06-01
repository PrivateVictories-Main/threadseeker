<div align="center">

# ThreadSeeker

### A search engine for the entire open-source world.

One query. **28 sources.** Zero paid APIs, zero tracking, zero accounts.

[**▶ Live demo — threadseeker.pages.dev**](https://threadseeker.pages.dev)

[![CI](https://github.com/PrivateVictories-Main/threadseeker/actions/workflows/ci.yml/badge.svg)](https://github.com/PrivateVictories-Main/threadseeker/actions/workflows/ci.yml)
&nbsp;·&nbsp; Next.js 14 &nbsp;·&nbsp; TypeScript &nbsp;·&nbsp; Cloudflare Pages &nbsp;·&nbsp; MIT

</div>

---

ThreadSeeker is **Google for open source**: type what you're looking for — a single
word, an ecosystem (`rust http framework`), or a whole sentence — and it searches
GitHub, Hugging Face, npm, PyPI, crates.io, and **23 other registries, repo hosts,
and dev communities in parallel**, ranks everything into one unified result grid,
and hands you the install/clone command right on the card.

Nothing is stored or indexed ahead of time. Every search hits the upstream sources
**live**, so results reflect the open-source world *right now* — newest releases,
freshest stars, today's discussions. The whole thing is a single static site plus a
handful of serverless functions: **free to run, nothing to operate.**

---

## Why it exists

The open-source world is scattered across dozens of platforms. The package you need
might be on npm *and* GitHub *and* Docker Hub; the answer might be a Hugging Face
model, an arXiv paper with code, or a Reddit thread. ThreadSeeker collapses all of
that into one search box and one ranked, de-duplicated result set — so you can judge
*"is this the right project, and is it still alive?"* without opening fifteen tabs.

## Features

- **28 sources, one unified card grid.** Repos, packages, AI models, papers, and
  community threads, all normalized to the same card shape.
- **Search as broad or as specific as you like.** A one-word query and a full
  natural-language sentence both work — the ranker re-scores the live results with
  BM25 + curated query expansion so the canonical answer tends to win.
- **Streaming results.** The skeleton clears the moment the first source returns;
  the rest stream in behind it. A live "searching X of N sources" readout shows
  progress.
- **Cross-source de-duplication.** The same project surfaced on GitHub + PyPI +
  Docker Hub folds into one card with "also on" links to each platform.
- **Query-match highlighting.** Matched terms are marked in every card's name,
  description, and topics, so you can see *why* a result matched.
- **At-a-glance signals.** Stars / downloads, version, license bucket, and a
  maintenance signal (active / stale) on every card — judge a project without
  leaving the grid.
- **Copy the install command from the card.** `git clone`, `npm install`,
  `pip install`, `cargo add`, `gem install`, `docker pull`, `brew install`,
  `dotnet add package`, JSR, Gradle/Maven, and more — one click.
- **Resilient by design.** If a strict search comes back thin, ThreadSeeker
  automatically relaxes the query (token → synonym → distinctive-term) and tells
  you it broadened, rather than showing an empty page.
- **Built for keyboards.** `⌘K` command palette, `/` to focus, `j`/`k` to move
  through results, shareable URL state (query + sources + sort + view).
- **Bookmarks, history, grid/list views** — all client-side, nothing tracked.

## Sources

| Category | Platforms |
|---|---|
| **Repos** | GitHub · GitLab · Codeberg |
| **Packages** | npm · PyPI · crates.io · Maven Central · NuGet · Packagist · RubyGems · JSR · conda-forge · Docker Hub · Flathub · Homebrew · F-Droid · AUR · Open VSX · WordPress |
| **AI & ML** | Hugging Face · Papers with Code |
| **Scholarly** | arXiv · Zenodo |
| **Community** | Hacker News · Reddit · Lobsters · Stack Overflow · Dev.to |

## Architecture

```
┌──────────────────────────┐        ┌───────────────────────────────┐
│   Browser (Next.js SPA)  │ ─────► │  Public APIs (direct, CORS-OK) │
│                          │        │  GitHub, GitLab, Codeberg, HF, │
│  • fan-out to 28 sources │        │  npm, PyPI, crates, RubyGems,  │
│  • BM25 re-rank + dedup  │        │  JSR, NuGet, Maven, Open VSX,  │
│  • streaming + relaxation│        │  Zenodo, HN, Stack Overflow…   │
└───────────┬──────────────┘        └───────────────────────────────┘
            │
            │  /api/*  (same origin, same deployment)
            ▼
┌────────────────────────────────────────────┐
│        Cloudflare Pages Functions           │
│  /api/search-reddit    Reddit + sentiment   │
│  /api/search-homebrew  Homebrew (no search) │
│  /api/search-fdroid    F-Droid (no search)  │
│  /api/search-arxiv     arXiv Atom XML        │
│  /api/proxy            CORS proxy (Docker,   │
│                        Flathub, Lobsters,    │
│                        SO, PwC, WordPress…)  │
│                        + edge cache          │
└────────────────────────────────────────────┘
```

Most sources are queried **directly from the browser**. The few that block CORS,
or that have no search API at all (Homebrew, F-Droid), go through small Cloudflare
Pages Functions on the *same* deployment — so there is no separate backend, no
server to run, and **no API keys required.**

### How search works

1. **Parse** — operators (`lang:`, `stars:>1000`, `license:`, `source:`) are
   split out; the rest is free text.
2. **Expand** — a hand-curated synonym dictionary maps concepts to canonical
   projects (e.g. *"state management" + react → zustand/jotai/redux*) and a regex
   classifier tags intent (project / how-to / model / …).
3. **Fan out** — all selected sources are queried in parallel with a per-source
   timeout; results stream in as they arrive.
4. **Merge + rank** — cross-platform duplicates fold together, then the whole
   corpus is re-scored with BM25 over name/description/topics plus popularity,
   recency, exact-name, and intent signals.
5. **Relax if thin** — if too few results come back, the query is automatically
   broadened and the UI says so.

> The ranking layer is deterministic and runs entirely client-side — no API key,
> no per-query cost. (An optional LLM-powered query-understanding + synthesis layer
> is on the roadmap; the app is built so it degrades to this engine when no key is
> configured.)

## Quickstart

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000  (direct-CORS sources work)
```

To run the Pages Functions locally (Reddit, Homebrew, F-Droid, arXiv, CORS proxy):

```bash
cd frontend
NEXT_OUTPUT=export npm run build
npx wrangler pages dev out   # http://localhost:8788  (full source set)
```

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the one-click Cloudflare Pages deploy.

## Search-quality harness

```bash
cd frontend
npm run test       # vitest — ranking, merge, synonym + intent unit suite
npm run backtest   # live-API harness: precision@3 / MRR / winner-at-#1
                   #   over a canonical query set, with per-miss breakdown
```

## Tech stack

Next.js 14 (App Router, static export) · React 18 · TypeScript · Tailwind CSS ·
Framer Motion · Radix UI · lucide-react · Cloudflare Pages + Pages Functions ·
Vitest. No database, no Python, no paid APIs.

## Contributing

Issues and PRs welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md). The whole app
lives under `frontend/`; `npm run lint && npx tsc --noEmit && npm run test` is the
gate CI enforces on every push.

## License

[MIT](LICENSE).
