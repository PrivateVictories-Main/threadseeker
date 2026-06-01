# Deploying ThreadSeeker

**One deployment. One URL. No servers, no secrets.**

ThreadSeeker is a fully static Next.js site plus a handful of Cloudflare Pages
Functions that ship alongside it. The whole app — frontend, 28 source adapters,
and the CORS/no-search-API helper functions — runs on Cloudflare's free tier with
**no environment variables required.**

The live deployment is at **https://threadseeker.pages.dev**.

---

## 1. Push the repo to GitHub

Cloudflare Pages builds from git on every push.

## 2. Create a Pages project

In the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**,
pick the repo, and use these settings:

| Setting | Value |
|---|---|
| Framework preset | Next.js (Static HTML Export) |
| Build command | `NEXT_OUTPUT=export npm run build` |
| Build output directory | `out` |
| Root directory | `frontend` |
| Node version | `22` |

The `frontend/functions/` directory is picked up automatically — each file under
`functions/api/` becomes a route at `/api/*` on the same domain as the site.

## 3. Environment variables

**None are required.** The frontend talks to `/api/*` same-origin, so there's no
`NEXT_PUBLIC_BACKEND_URL` to set, and no API keys for any source.

> Heads-up for future work: an optional LLM query-understanding / synthesis layer
> is planned. When it lands it will read a single secret (e.g. `GROQ_API_KEY`) set
> on the Pages project, and degrade gracefully to the deterministic ranker when the
> secret is absent. It is **not** wired up today, so don't set it yet.

## 4. Deploy

Cloudflare builds on every push to the connected branch. That's it.

---

## What runs where

| Feature | Where | Needs a key? |
|---|---|---|
| GitHub / GitLab / Codeberg | Browser (direct) | No |
| npm / PyPI / crates / Packagist / RubyGems / JSR / Open VSX / NuGet / Maven / conda / Zenodo | Browser (direct) | No |
| Hugging Face | Browser (direct) | No |
| Hacker News / Dev.to / Stack Overflow | Browser (direct) | No |
| Reddit (+ sentiment) | Pages Function `/api/search-reddit` | No |
| Docker Hub / Flathub / Lobsters / Papers with Code / AUR / WordPress | Pages Function `/api/proxy` (CORS) | No |
| Homebrew (no search API) | Pages Function `/api/search-homebrew` | No |
| F-Droid (no search API) | Pages Function `/api/search-fdroid` | No |
| arXiv (Atom XML) | Pages Function `/api/search-arxiv` | No |

## Caching

The CORS proxy edge-caches upstream responses so common queries stay fast and stay
within rate limits:

- `/api/proxy` — short per-URL TTL via the Cloudflare Cache API.
- `/api/search-homebrew`, `/api/search-fdroid` — the large upstream indexes are
  cached and filtered server-side.
- `/api/search-arxiv` — per-query TTL.

---

## Local development

```bash
cd frontend
npm install

# Option A — frontend only (direct-CORS sources work)
npm run dev
# -> http://localhost:3000

# Option B — frontend + Pages Functions (full source set: Reddit, Homebrew,
# F-Droid, arXiv, and the CORS proxy)
NEXT_OUTPUT=export npm run build
npx wrangler pages dev out
# -> http://localhost:8788  (serves the static site AND /api/* together)
```

For Option B, hit the Wrangler URL directly — it matches production exactly.

---

## Custom domain

In the Pages project: **Custom domains → Set up a custom domain**, add the CNAME at
your registrar, and Cloudflare provisions the certificate automatically. No other
changes needed.
