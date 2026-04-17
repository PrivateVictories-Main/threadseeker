# Deploying ThreadSeeker

One deployment. One URL. No servers.

ThreadSeeker is a fully static Next.js site plus a handful of Cloudflare
Pages Functions that ship alongside it. The whole app — frontend, Reddit
search, AI query optimization, cross-source synthesis — runs on Cloudflare's
free tier.

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
itself. Everything else (Reddit search, 10 public-API sources) still works.

## 4. Deploy

Cloudflare builds on every push. That's it.

---

## What runs where

| Feature                                       | Where         | Needs secret? |
|-----------------------------------------------|---------------|---------------|
| GitHub / GitLab / Codeberg search             | Browser       | No            |
| npm / PyPI / crates.io / Packagist / RubyGems | Browser       | No            |
| Hugging Face search                           | Browser       | No            |
| Hacker News search                            | Browser       | No            |
| WebLLM (in-browser LLM)                       | Browser       | No            |
| Reddit search + sentiment                     | Pages Function| No            |
| AI query optimization                         | Pages Function| `GROQ_API_KEY`|
| Cross-source synthesis                        | Pages Function| `GROQ_API_KEY`|

---

## COOP/COEP headers

Required so WebLLM (in-browser LLM inference) can use `SharedArrayBuffer`
and WebGPU. Already provisioned via `frontend/public/_headers` — Cloudflare
Pages reads that file automatically.

---

## Local development

```bash
# Install deps
cd frontend
npm install

# Option A — frontend only (no backend features)
# Works with all 10 public-API sources + WebLLM. Reddit + AI are disabled.
echo "NEXT_PUBLIC_BACKEND_URL=disabled" > .env.local
npm run dev
# -> http://localhost:3000

# Option B — frontend + Pages Functions (full feature set)
# Requires the Cloudflare Wrangler CLI:
npm install -g wrangler
export GROQ_API_KEY=gsk_...          # your Groq key
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
