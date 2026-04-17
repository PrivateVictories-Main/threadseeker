# Deploying ThreadSeeker

Two independent pieces:

- **Frontend** — static Next.js site → Cloudflare Pages (free)
- **Backend** — FastAPI service → runs locally during development; deployment
  target is **not yet decided** (see "Backend hosting" below)

The frontend works without the backend. Features that require the backend:
Reddit search, AI query optimization, cross-source AI synthesis, Trafilatura
content extraction. Everything else (GitHub, HF, GitLab, npm, PyPI, crates.io,
HN, Codeberg, Packagist, RubyGems) hits public APIs directly from the browser
and needs no server.

---

## Frontend — Cloudflare Pages

### 1. Push the repo to GitHub

Cloudflare Pages pulls from git.

### 2. Create a new Pages project

- **Framework preset:** Next.js (Static HTML Export)
- **Build command:** `NEXT_OUTPUT=export npm run build`
- **Build output directory:** `out`
- **Root directory:** `frontend`
- **Node version:** 20

### 3. Environment variables

Set on the Pages project (Production + Preview):

```
NEXT_PUBLIC_BACKEND_URL=<https url of your backend, or leave blank>
```

Leave blank to deploy a backend-free build — everything still works except
Reddit search and the AI features, which degrade gracefully (the UI hides
them silently).

### 4. COOP/COEP headers

Already provisioned via `frontend/public/_headers`. These are required so
WebLLM (in-browser LLM inference) can use `SharedArrayBuffer` / WebGPU.

---

## Backend — hosting (TBD)

The backend is packaged as a Docker image (`backend/Dockerfile`) and has a
`docker-compose.yml` at the repo root, but **nothing is currently deployed
anywhere**. Pick a host when you're ready:

- **Fly.io** — free tier, `fly launch` from the repo root, works out of the box
- **Render / Railway** — free web-service tiers; point at `backend/Dockerfile`
- **Your own VPS** — set `DOMAIN` env var, run `docker compose up -d --build`
- **Cloudflare Workers** — not viable; the backend depends on Trafilatura + Groq
  SDK which need Python, not JS.

Whichever you pick, the backend needs:
- Outbound internet (DuckDuckGo for Reddit, Groq/Gemini, target URLs for Trafilatura)
- `GROQ_API_KEY` env var (Gemini is an optional fallback)
- Optional: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for shared cache

Then point the Cloudflare Pages `NEXT_PUBLIC_BACKEND_URL` at its public URL.

---

## Local development

```bash
# Terminal 1 — backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in keys
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
cp .env.example .env.local  # set NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
npm install
npm run dev
```

Or run just the frontend — it'll work with all 10 public-API sources and the
in-browser WebLLM chat; only Reddit/synthesis features are disabled.

---

## What goes where

| Feature                          | Runs on    | Needs backend? |
|----------------------------------|------------|----------------|
| GitHub / GitLab / Codeberg search| Browser    | No             |
| npm / PyPI / crates.io / Packagist / RubyGems | Browser | No |
| Hugging Face search              | Browser    | No             |
| Hacker News search               | Browser    | No             |
| Reddit search                    | Backend    | Yes (CORS)     |
| AI query optimization            | Backend    | Yes (hidden keys) |
| Cross-source synthesis           | Backend    | Yes            |
| WebLLM (in-browser inference)    | Browser    | No             |
| Content extraction (Trafilatura) | Backend    | Yes            |
