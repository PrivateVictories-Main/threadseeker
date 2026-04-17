# Deploying ThreadSeeker

One deployment. One URL. No servers.

ThreadSeeker is a fully static Next.js site plus a handful of Cloudflare
Pages Functions that ship alongside it. The whole app — frontend, 24
source adapters, AI query optimization, cross-source synthesis — runs on
Cloudflare's free tier.

---

## 1. Push the repo to GitHub

Cloudflare Pages pulls from git.

## 2. Create a new Pages project

In the Cloudflare dashboard, create a Pages project and connect it to the
GitHub repo. Use these settings:

- **Framework preset:** Next.js (Static HTML Export)
- **Build command:** `NEXT_OUTPUT=export npm run build`
- **Build output directory:** `out`
- **Root directory:** `frontend`
- **Node version:** 20

The `functions/` directory under `frontend/` is picked up automatically and
deployed as Pages Functions — each file under `functions/api/` becomes a
route at `/api/*` on the same domain as the site.

## 3. Environment variables & secrets

Set on the Pages project (Production + Preview):

| Variable        | Type   | Purpose                                          |
|-----------------|--------|--------------------------------------------------|
| `GROQ_API_KEY`  | Secret | Powers AI query optimization + synthesis         |

No other variables are needed. The frontend talks to `/api/*` same-origin,
so there's no `NEXT_PUBLIC_BACKEND_URL` to configure.

If `GROQ_API_KEY` isn't set, the AI features degrade gracefully — query
optimization falls back to rule-based queries and the synthesis box hides
itself. Everything else (20 other sources) still works.

## 4. Deploy

Cloudflare builds on every push. That's it.

---

## What runs where

| Feature                                        | Where          | Needs secret?  |
|------------------------------------------------|----------------|----------------|
| GitHub / GitLab / Codeberg search              | Browser        | No             |
| npm / PyPI / crates / Packagist / RubyGems / JSR / Open VSX | Browser | No      |
| Hugging Face search                            | Browser        | No             |
| Hacker News / Dev.to search                    | Browser        | No             |
| Reddit search + sentiment                      | Pages Function | No             |
| Docker Hub / Flathub / Lobsters / SO / Papers with Code / AUR / conda-forge | Pages Function (CORS proxy) | No |
| Homebrew search                                | Pages Function | No             |
| F-Droid search                                 | Pages Function | No             |
| arXiv search                                   | Pages Function | No             |
| AI query optimization                          | Pages Function | `GROQ_API_KEY` |
| Cross-source synthesis                         | Pages Function | `GROQ_API_KEY` |

---

## Caching

Groq calls are edge-cached via the Cloudflare Cache API so the second person
to search `"react state management"` never waits for an LLM call:

- `/api/optimize-queries` — 24 h TTL, keyed by `[query, intent, year]`
- `/api/synthesize` — 1 h TTL, keyed by `[query, top-8 project names]`
- `/api/search-homebrew` — 30 min TTL per query; upstream index cached 24 h
- `/api/search-fdroid` — 1 h in-isolate cache; upstream index cached 24 h
- `/api/search-arxiv` — 6 h TTL per query
- `/api/proxy` — 5 min TTL per upstream URL

---

## Local development

```bash
# Install deps
cd frontend
npm install

# Option A — frontend only (most sources work)
# Works with the public-API sources. Sources that go through Pages
# Functions (Reddit, Docker Hub, Flathub, Lobsters, Stack Overflow, Papers
# with Code, Homebrew, F-Droid, arXiv, AI features) are disabled.
echo "NEXT_PUBLIC_BACKEND_URL=disabled" > .env.local
npm run dev
# -> http://localhost:3000

# Option B — frontend + Pages Functions (full feature set)
# Requires the Cloudflare Wrangler CLI:
npm install -g wrangler
export GROQ_API_KEY=gsk_…              # your Groq key (optional)
NEXT_OUTPUT=export npm run build
wrangler pages dev out
# -> http://localhost:8788
```

For Option B, hit the Wrangler URL directly — it serves both the static
site and `/api/*` functions together, matching production exactly.

---

## Custom domain

In the Pages project: **Custom domains → Set up a custom domain**, then
add a CNAME at your registrar. Cloudflare provisions the cert
automatically. No other changes needed.
