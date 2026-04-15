# ThreadSeeker

**A unified search engine for the open-source world.** One query, 11 sources,
zero paid APIs.

ThreadSeeker searches GitHub, Hugging Face, GitLab, Codeberg, npm, PyPI,
crates.io, Packagist, RubyGems, Hacker News, and Reddit in parallel, then
lets you copy the install/clone command for whatever you find — right from
the result card.

It's built to be **free to run**: the frontend is a static Next.js site
(Cloudflare Pages free tier), the backend is a single FastAPI container
(your own VPS), and every data source is a public API or a free scraping
route. The only optional expense is a domain.

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
         │ (only for things the browser can't do)
         ▼
┌────────────────────┐
│   FastAPI backend  │
│                    │
│  - Reddit search   │  (CORS-blocked, needs server proxy)
│  - AI optimization │  (Groq / Gemini keys stay server-side)
│  - AI synthesis    │  (multi-source summary)
│  - Content extract │  (Trafilatura, Python-only)
└────────────────────┘
```

The frontend works on its own — the backend adds Reddit, server-side AI,
and content extraction but isn't required.

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
- **Query refinement** — ambiguous queries prompt clarifying questions.
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
# Backend
cd backend
cp .env.example .env  # fill in GROQ_API_KEY (optional)
docker compose up -d --build  # from repo root

# Frontend
cd frontend
cp .env.example .env.local    # set NEXT_PUBLIC_BACKEND_URL
npm install
npm run dev                   # dev
NEXT_OUTPUT=export npm run build  # static build → out/
```

---

## Repo layout

```
backend/        FastAPI service (Dockerfile, requirements.txt)
frontend/       Next.js 14 SPA (static-export ready for Cloudflare Pages)
docs/           DEPLOY.md and historical design docs
docker-compose.yml   Traefik-ready compose for the backend
```

---

## License

See [LICENSE](LICENSE).
