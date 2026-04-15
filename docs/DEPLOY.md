# Deploying ThreadSeeker

Two independent pieces:

- **Frontend** — static Next.js site → Cloudflare Pages (free tier)
- **Backend** — FastAPI service → Docker on your own VPS (free, uses existing host)

The frontend works without the backend — Reddit search, AI query optimization,
and cross-source synthesis are the only features that require it.

---

## Backend (VPS, Docker + Traefik)

Conventions match the existing `/opt/services/` layout: `traefik-net`, JSON
log driver with rotation, pinned image tag, health check.

### 1. Copy the repo to the VPS

```bash
ssh server 'mkdir -p /opt/services/websites/threadseeker'
rsync -av --exclude node_modules --exclude .next --exclude __pycache__ \
  ./ server:/opt/services/websites/threadseeker/
```

### 2. Create `backend/.env`

```bash
ssh server
cd /opt/services/websites/threadseeker/backend
cp .env.example .env
# edit .env — set GROQ_API_KEY (required), GEMINI_API_KEY (fallback),
# UPSTASH_REDIS_* (optional, cache works without)
```

### 3. Build and launch

```bash
cd /opt/services/websites/threadseeker
docker compose up -d --build
docker compose ps
docker compose logs -f threadseeker-api
```

The container joins `traefik-net` and exposes `api.threadseeker.<domain>`
via Traefik's existing Let's Encrypt resolver. Set a `DOMAIN` env var on
the host (or edit `docker-compose.yml` directly) to override the default.

### 4. Verify

```bash
curl -fsS https://api.threadseeker.<domain>/health
curl -fsS https://api.threadseeker.<domain>/ai-status
```

---

## Frontend (Cloudflare Pages)

### 1. Push the repo to GitHub

Cloudflare Pages pulls from git. Any repo will do.

### 2. Create a new Pages project

- **Framework preset:** Next.js (Static HTML Export)
- **Build command:** `NEXT_OUTPUT=export npm run build`
- **Build output directory:** `out`
- **Root directory:** `frontend`
- **Node version:** 20

### 3. Environment variables

Set on the Pages project (Production + Preview):

```
NEXT_PUBLIC_BACKEND_URL=https://api.threadseeker.<your-domain>
```

Leave blank to deploy a backend-free build — everything still works except
Reddit and AI features, which degrade gracefully.

### 4. COOP/COEP headers

Already provisioned via `frontend/public/_headers`. These are required so
WebLLM (in-browser LLM inference) can use `SharedArrayBuffer` / WebGPU.

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
