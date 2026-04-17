# Changelog

All notable changes to ThreadSeeker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

## [Unreleased]

### Planned
- [ ] Saved searches / bookmarks (local-first, no account required)
- [ ] More registries: Bitbucket, Launchpad, AUR, conda-forge
- [ ] Date-range and language filters in the results toolbar
- [ ] Browser extension (omnibox search)
- [ ] Shareable permalink that also restores sort + source filter

---

## Version History

### Version 1.0.0 - Initial Release (2025-01-29)
The first stable release of ThreadSeeker with all core features implemented and tested.

**Key Highlights:**
- Complete multi-platform search engine
- AI-powered query optimization
- 100+ intelligent autocomplete suggestions
- Advanced spell-checking and fuzzy matching
- Instant loading with smart caching
- Premium UI with smooth animations
- Voice search capability
- Comprehensive documentation

**Statistics:**
- 5,187 lines of code
- 22 files committed
- 10 categories of suggestions
- 150+ spell corrections
- <100ms load time (cached)

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this changelog.

---

## Links

- [Homepage](https://github.com/PrivateVictories-Main/threadseeker)
- [Issues](https://github.com/PrivateVictories-Main/threadseeker/issues)
- [Pull Requests](https://github.com/PrivateVictories-Main/threadseeker/pulls)
