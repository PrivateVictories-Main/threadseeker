# Changelog

All notable changes to ThreadSeeker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [5.0.0] - 2026-06-10

The identity release. ThreadSeeker stops wearing the default AI-generated
uniform (Tailwind indigo, violet glass, neutral type) and gets a face of its
own — same Liquid-Glass physics, entirely new material.

### Changed
- **Palette** — deep emerald ink replaces the indigo family everywhere (one
  token swap plus a ~60-site literal sweep); warm sage-paper light mode,
  deep green-ink dark mode. The dead `.dark .{*}indigo{*}` utility-remap
  layer is gone.
- **The thread is now an amber filament** — a second reserved accent for the
  brand moments only: the hero phrase "one thread.", the search-progress
  thread and its glow head, the deep-match pill, the constellation's
  traveling pulse, and the aurora's warm breath.
- **Typography** — Bricolage Grotesque carries the display voice (hero
  headline); Outfit stays the body, JetBrains Mono stays the meta-label
  voice.
- **Texture** — a whisper-opacity film grain over the whole canvas, so the
  gradients read as material instead of generated.
- Per-query intent tints re-homed in the new families (emerald default,
  amber for model hunts, clay for troubleshooting); brand surfaces (app
  icon, OG card, stat tiles, modal scrims) re-skinned to match.

## [4.1.0] - 2026-06-10

### Added
- **vcpkg (C/C++) and MELPA (Emacs)** — 40 sources total. Neither upstream has
  a search API, so both use dedicated Pages Functions that edge-cache the full
  package index (1 day) and filter server-side, with honest metadata only
  (vcpkg: real SPDX licenses + last-modified dates; MELPA: real download
  counts joined from `download_counts.json`).
- **Self-hosted semantic model** — the 23 MiB embedding weights are vendored at
  build time (`scripts/fetch-semantic-assets.mjs`) and served same-origin from
  `/models/`, so visitors no longer depend on the Hugging Face CDN for the
  heavyweight download (with automatic CDN fallback if the local copy is
  missing). Warm inference measured at 1.5 s, down from ~4 s.
- A `paragraph` backtest category: eight multi-sentence "context first, ask
  last" queries — the vision case — scored against the deterministic pipeline.

### Changed
- Interrogative/relative framing words (`where`, `when`, `why`, `while`,
  `shows`, `leaving`, `runs`) no longer consume upstream fetch-term slots.
- Three new synonym-dictionary concepts: disk-usage (ncdu/dust/gdu),
  network-adblock (Pi-hole/AdGuard Home/blocky), terminal-git-ui
  (lazygit/gitui/tig).
- The first four result covers load eagerly with `fetchpriority=high` — a
  lazy-loaded cover was the page's LCP element, discovered 1.2 s late
  (production Lighthouse: accessibility/best-practices/SEO all 100).

## [4.0.0] - 2026-06-10

The "layered AI" release: a keyless in-browser semantic rerank on top of a
substantially smarter deterministic ranker, **38 live sources** (was 29), SEO
landing pages, PWA installability, and a much heavier test/CI gate. Still zero
required keys, zero paid APIs.

### Added — keyless semantic rerank
- A small retrieval-trained embedding model (`mxbai-embed-xsmall-v1`, 24 MB
  quantized, Apache-2.0) runs **in the user's browser** in a Web Worker via a
  pinned transformers.js — WebGPU when a real GPU adapter probe succeeds, WASM
  otherwise. After the BM25 order paints, it cosine-scores the top results
  against the *full* query text and rank-fuses that ordering in, weighted by
  query length (keyword queries stay BM25-led; paragraph queries go
  semantic-led). No API, no key, no per-query cost; any failure (no Worker,
  Save-Data, model download, GPU init) degrades silently to pure BM25.
- The worker is a static module file outside the app bundle; CSP extended
  minimally (`wasm-unsafe-eval` + the pinned CDN host), documented in `_headers`.

### Added — optional AI layer (Groq)
- **`/api/rerank`** — the LLM now influences *ordering*, not just the verdict:
  it re-orders the top deterministic results and the client rank-fuses that
  with BM25, so a bad/partial/empty response can nudge but never tank. As with
  the rest of the AI layer, no `GROQ_API_KEY` → pure deterministic baseline.

### Changed — search quality (deterministic, keyless)
- **Paragraph queries rank the THING, not threads about the thing.** Key-term
  extraction picks upstream search terms by subject-likeness (rarity,
  tech-shape, sentence position) instead of first-N word order, so a
  three-sentence description fetches the ask instead of truncating it away.
- BM25 became **BM25F**: a term in the project *name* (4×) outweighs the same
  term buried in a description, so a low-star exact-name match can beat a
  45k-star repo that mentions the term in passing.
- New term-**coverage** bonus (superlinear — matching ALL content terms beats
  matching one rare term heavily) and **bigram-adjacency** bonus ("react
  native" adjacent ≫ scattered).
- **Exact-name rank floor**: a query that *is* a project's name can no longer
  be buried by popularity stacking — the best exact match is promoted to the
  top 3.
- Thread sources (Reddit/HN/SO/Lobsters/Dev.to) score their title at
  description weight and upvotes at half a star's value; archived repos take a
  heavy penalty; query-framing filler ("best", "looking", "need") is
  down-weighted; relaxation broadens to *content* terms, not filler.
- Featured rail no longer vanishes on a GitHub rate-limit.

### Changed — sources: 29 → 38
- **9 new sources, every one live-verified**: Modrinth, CRAN, Firefox Add-ons,
  Greasy Fork, Terraform Registry, Snapcraft, Ansible Galaxy, GNOME
  Extensions, Chocolatey.
- **4 dead sources revived** (each had silently returned nothing): WordPress
  (upstream date-format change), Flathub (search went POST-only — the proxy
  gained a tightly-allowlisted POST passthrough), Lobsters (search endpoint
  400s — degrade to hottest-filtered), Docker Hub (official-image links).
- **Papers with Code retired** — the service shut down (now redirects to
  Hugging Face). Removed across all wiring points.
- Honest-signals rule enforced: no fabricated stars/downloads anywhere — a
  source with no popularity number ships without one. `AbortSignal` threaded
  through every adapter, so superseded searches actually cancel.
- All source counts in the UI/metadata derive from the registry — every
  surface says 38 because the registry does.

### Added — SEO + PWA
- **`/search/[slug]` landing pages**: 53 statically-exported, individually
  indexable pages derived from the curated suggestion corpus (single source of
  truth shared with `sitemap.ts`), each with unique metadata, JSON-LD, and the
  live app mounted underneath. One indexable URL became 54.
- **Installable PWA**: web manifest + icons; richer structured data; honest
  `robots` rules.

### Changed — UI
- **Paragraph-first search bar**: an auto-growing textarea command surface —
  multi-sentence queries are a first-class input, not an afterthought.
- Google-style autocomplete dropdown, glassy left sidebar, redesigned calm
  hero backdrop, list-view/grid-view visual parity, ultrawide (4–5 column)
  grid, dark-mode contrast fixes, deep-match pill.

### Performance
- The search engine is no longer in the first-paint bundle (lazy-loaded on
  first search); memoized result cards; lazy modal chunks; a concurrency cap
  on the source fan-out; bounded OG-image requests.

### Accessibility
- Command palette is a real combobox (screen-reader drivable); AI verdict is
  announced; focus traps on all modals; reduced-motion honored; ultrawide
  breakpoint + touch-target fixes.

### Security
- Closed an origin-render hole on `/api/gh?accept=`; stopped edge-caching
  transient upstream failures; escaped control-char regex literals and clamped
  AI cache-key parts in the Functions.

### Tests / CI
- Suite grew to **475 tests**, including 38×7 parameterized golden-payload
  adapter tests (realistic fixtures, never-throw degradation, HTTP failure,
  signal forwarding).
- CI now also runs: Pages Functions typecheck, coverage gate, Playwright
  dual-theme e2e smoke, a **weekly live upstream-drift job** (a silently dead
  upstream API turns CI red even when nobody commits), and a post-deploy
  smoke workflow against the live site.

## [3.0.0] - 2026-06-02

Heavy security/quality audit pass. **29 live sources** (prior entries said 24).

### Security
- **Redirect-SSRF + token exfiltration closed.** `/api/proxy` and `/api/gh` now
  fetch with `redirect:"manual"` and refuse any 3xx (the host allowlist only
  validated the first hop). On `/api/gh` the default redirect-follow had also
  forwarded `Authorization: Bearer <GITHUB_TOKEN>` to GitHub's cross-host 302s.
- **Click-XSS closed.** New `safeHref()` scheme allowlist (http/https/mailto)
  routed through every dynamic href — author-controlled upstream homepage/post
  URLs can no longer inject `javascript:`/`data:` links.
- **`/api/proxy` content lockdown.** Forces a non-HTML response Content-Type
  (text/plain + attachment for non-JSON), so it can't reflect attacker HTML
  under our origin.
- **Prompt-injection delimiter smuggle closed.** AI synthesis wraps untrusted
  query/results in a per-request random nonce delimiter the data can't forge.
- **Real Content-Security-Policy** (was `frame-ancestors 'none'` only):
  `script-src 'self' 'unsafe-inline'`, `object-src 'none'`, `base-uri 'self'`,
  `connect-src/img-src https:`.

### Fixed — search quality
- GitLab/Codeberg no longer get GitHub `OR` syntax (it collapsed their recall
  ~100× / to zero on multi-word queries).
- JSR/WordPress stop reporting a fabricated "★" count (quality/installs now go
  through `popularityScore`/`downloads`); Reddit stops faking recency; ranking
  recency is an explicit no-signal for blank timestamps.

### Added — SEO / tests / tooling
- Crawlable `<a href="/?q=…">` example chips, `rel=canonical`, generated
  `app/sitemap.ts`.
- Pages Functions test harness + `useSearch` hook tests + a deterministic
  ranking-quality gate; `@vitest/coverage-v8` +
  `test:coverage`.
- Re-enabled `no-unused-vars` (error) / `no-explicit-any` (warn); deleted dead
  code (`actions.ts`, `Sparkline`).
- `wrangler.toml` for prod-parity local dev (`wrangler pages dev out`).

## [2.2.0] - 2026-04-17

### Added — 3 more sources + UX polish

- **AUR** (Arch User Repository), **Open VSX** (VS Code / VSCodium
  extensions, Eclipse Foundation), and **conda-forge** (anaconda.org).
  Brings the total to **24 sources**.
- **Per-source 12 s timeout**: one flaky upstream can no longer stall
  the "still searching" counter.
- **URL state**: sort mode and active source-chip filter now persist
  in the URL so shared links restore the exact view.
- **"/" keyboard shortcut** focuses the search input (classic
  Google / GitHub UX).
- **Pending source icons**: the status line now renders each still-in-
  flight source's emoji, giving visible streaming progress instead of
  just a bare count.

## [2.1.0] - 2026-04-17

### Added — 10 new sources + dedup + highlighting

- **10 new sources**: Docker Hub, JSR, Flathub, Dev.to, Lobsters, Stack
  Overflow, Papers with Code, Homebrew, F-Droid, arXiv — bringing the
  total to 21.
- **CORS proxy Pages Function** (`/api/proxy`) with host allowlist for
  sources that block browser CORS (Docker Hub, Flathub, Lobsters, Stack
  Overflow, Papers with Code).
- **Server-side index search** for sources with no search API
  (`/api/search-homebrew`, `/api/search-fdroid`).
- **arXiv Atom-XML adapter** (`/api/search-arxiv`).
- **Cross-source dedup**: same project on GitHub + PyPI + Docker Hub
  folds into a single card with "Also on" chips.
- **Query-term highlighting**: matched terms wrapped in `<mark>` in card
  name + description.
- **Streaming results**: skeleton clears the moment the first source
  returns; remaining sources stream in.
- **Edge-cached Groq calls**: query optimization cached 24h, synthesis
  cached 1h via Cloudflare Cache API.
- **`<link rel="preconnect">`** for 11 API hosts — shaves first-query
  latency.

### Changed

- Ranking: trending boost (1k+ stars, <90d updated → +800), abandonment
  penalty (>3y stale AND <500 stars), zero-signal penalty, all-token
  whole-word match boost, intent-aware language/source matching.
- GitHub and Hugging Face search strategies run in parallel instead of
  sequential — ~40% latency cut on the slowest sources.
- Synthesis prompt expanded to 5 buckets (repos / models+papers /
  packages / containers+desktop / community).

### Removed

- **BYOK (bring-your-own-key)**: no browser-side API key input. Server's
  `GROQ_API_KEY` serves all users; AI degrades gracefully without it.
- WebLLM / in-browser LLM inference — the server-side Groq path is
  faster, free, and doesn't require a GPU.

## [2.0.0] - 2026-04-17

### Changed — serverless architecture

- **Backend is now Cloudflare Pages Functions**, not a separate FastAPI
  service. The whole app (static site + Reddit / AI functions) ships as
  one Cloudflare Pages deployment. No containers, no VPS, no separate host.
- **Reddit search** ported to a Pages Function calling reddit.com's JSON
  endpoints directly (the old DuckDuckGo indirection isn't needed from a
  Worker egress IP).
- **`/api/optimize-queries` and `/api/synthesize`** port the Groq calls to
  TypeScript with the same prompts, intent classification, and fallbacks
  as the Python version.
- Frontend hits `/api/*` same-origin — no more `NEXT_PUBLIC_BACKEND_URL`
  required in production.
- Gemini fallback and Trafilatura content extraction dropped (the latter
  was dead code in the frontend). Rule-based query fallback preserved.

### Removed

- `backend/` directory, Dockerfile, `docker-compose.yml`
- `analyzeQuery` / query-refinement endpoints (frontend no longer calls them)

## [1.0.0] - 2025-01-29

### Added
- 🚀 **Initial Release** - Complete ThreadSeeker application
- 🔍 **Multi-Platform Search** - Search GitHub, Hugging Face, and Reddit simultaneously
- 🤖 **AI-Powered Query Optimization** - Using Groq's Llama 3.3 70B
- 🧠 **Intelligent Autocomplete** with 100+ suggestions
- ✨ **Advanced Fuzzy Spell-Checking** with Levenshtein distance algorithm
- 📝 **150+ Spell Corrections Dictionary**
- 🕐 **Search History Integration** - Personalized suggestions from recent searches
- 🎯 **Context-Aware Matching** - Multi-factor scoring system
- 🔥 **Trending Content** - Real-time trending projects and discussions
- 💬 **Voice Input** - Search using Web Speech API
- 🎨 **Premium UI** - Glassmorphism design inspired by Gemini and Perplexity
- 🎭 **In-App Preview Modal** - View project details without leaving the app
- ⚡ **Instant Loading** - Triple-cache system for sub-100ms load times
- 🎬 **Smooth Animations** - Powered by Framer Motion
- ⌨️ **Keyboard Navigation** - Full keyboard support (↑↓↵ Tab Esc)
- 📱 **Responsive Design** - Works on all screen sizes
- 🌙 **Dark Mode** - Premium monochrome color scheme
- 🔐 **Intelligent Ranking** - Results sorted by relevance and popularity
- ⚠️ **Community Warnings** - Flags NSFW/quarantined Reddit content

### Frontend
- **Next.js 15** with React 19
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **shadcn/ui** components
- **Web Speech API** integration

### Backend
- **FastAPI** REST API
- **Groq API** for LLM inference
- **DuckDuckGo Search** for web scraping
- **Parallel search** across platforms
- **Intelligent ranking** algorithm
- **Pydantic** validation

### Performance
- First load: <800ms
- Repeat load (cached): <100ms
- Search results: ~2s average
- Autocomplete: <50ms
- Trending content: Instant (cached)

### Documentation
- Comprehensive README.md
- 13 detailed documentation files
- API documentation
- Contributing guidelines
- MIT License

---

## Links

- [Homepage](https://github.com/PrivateVictories-Main/threadseeker)
- [Issues](https://github.com/PrivateVictories-Main/threadseeker/issues)
- [Pull Requests](https://github.com/PrivateVictories-Main/threadseeker/pulls)
