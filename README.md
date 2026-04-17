# ThreadSeeker

**A unified search engine for the open-source world.** One query, 11 sources,
zero paid APIs.

ThreadSeeker searches GitHub, Hugging Face, GitLab, Codeberg, npm, PyPI,
crates.io, Packagist, RubyGems, Hacker News, and Reddit in parallel, then
lets you copy the install/clone command for whatever you find — right from
the result card.

It's built to be **free to run**: the whole app — frontend plus a few
serverless functions for the things the browser can't do — ships as a
single Cloudflare Pages deployment. No servers, no containers, no ongoing
cost beyond an (optional) custom domain.

---

## Architecture

```
┌────────────────────┐         ┌──────────────────────────┐
│   Browser (SPA)    │ ──────► │  Public APIs (direct)    │
│                    │         │  GitHub, HF, npm, PyPI,  │
│  Next.js 14 SPA    │         │  GitLab, Codeberg,       │
│  WebLLM (WebGPU)   │         │  crates.io, Packagist,   │
│  Multi-AI provider │         │  RubyGems, Hacker News   │
└────────┬───────────┘         └──────────────────────────┘
         │
         │  /api/*  (same-origin, same deployment)
         ▼
┌────────────────────────────┐
│  Cloudflare Pages Functions│
│                            │
│  - /api/search-reddit      │  Reddit (CORS-blocked, + sentiment)
│  - /api/optimize-queries   │  AI query → per-platform queries
│  - /api/synthesize         │  Cross-source AI verdict
└────────────────────────────┘
```

The frontend works on its own against 10 public APIs — the Pages Functions
add Reddit and server-side AI. Only a `GROQ_API_KEY` secret is needed for
the AI features.

---

## Features

- **11 sources**, unified card UI: GitHub, Hugging Face, GitLab, Codeberg,
  npm, PyPI, crates.io, Packagist, RubyGems, Hacker News, Reddit.
- **Level 1 integration actions** — per-source copy-to-clipboard commands
  (`git clone …`, `npm install …`, `pip install …`, `cargo add …`,
  `composer require …`, `gem install …`, `huggingface-cli download …`,
  etc.) rendered inline on every result.
- **Query optimization** — natural-language query → three per-platform
  optimized queries, with intent classification.
- **Cross-source synthesis** — single AI-written summary of the unified
  result set.
- **In-browser AI** — WebLLM runs Llama/Qwen on the user's GPU; no API
  keys required.
- **Bring-your-own-key** — optional OpenAI, Anthropic, or OpenRouter keys
  stored locally in the browser.

---

## Quickstart

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full playbook. The short
version:

```bash
cd frontend
npm install
npm run dev                         # http://localhost:3000 (no backend features)

# ...or with Pages Functions locally:
NEXT_OUTPUT=export npm run build
GROQ_API_KEY=gsk_... wrangler pages dev out   # http://localhost:8788
```

Deploy: push to GitHub, connect the repo to Cloudflare Pages, set
`GROQ_API_KEY` as a secret. Done.

---

## Repo layout

```
frontend/
  src/              Next.js 14 SPA
  functions/api/    Cloudflare Pages Functions (Reddit, AI)
  public/_headers   COOP/COEP for WebLLM
docs/               DEPLOY.md and historical design notes
```

---

## License

See [LICENSE](LICENSE).
