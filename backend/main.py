"""ThreadSeeker backend — slim API surface for the unified search frontend.

Responsibilities (what the browser can't do itself):
  - Reddit search (CORS blocked) with sentiment analysis
  - AI query optimization (keeps Groq/Gemini keys server-side)
  - AI synthesis across multi-source results
  - Content extraction via Trafilatura (Python-only)
  - Query ambiguity analysis and refinement

The frontend calls public APIs directly (GitHub, HF, GitLab, npm, PyPI,
crates.io, HN, Codeberg, Packagist, RubyGems) — the backend never touches
those sources.
"""
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_logic import (
    generate_search_queries,
    synthesize_results,
    analyze_query_ambiguity,
    refine_query_with_answers,
    get_groq_client,
    get_gemini_model,
)
from models import (
    HealthResponse,
    SearchRequest,
    QueryRefinementResponse,
    GitHubResult,
    HuggingFaceResult,
    RedditResult,
)
from search_logic import search_reddit
from ranking import rank_reddit_results
from cache import get_cache
from content_extractor import extract_multiple_urls
from security import (
    setup_security_middleware,
    APIKeyValidator,
    QuerySanitizer,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 ThreadSeeker API starting...")
    cache = get_cache()
    print(f"✅ Cache: {'enabled' if cache.enabled else 'disabled'}")
    yield
    print("👋 ThreadSeeker API shutting down...")


app = FastAPI(
    title="ThreadSeeker API",
    description="Backend for the unified open-source search engine. Handles Reddit, AI, and content extraction.",
    version="3.0.0",
    lifespan=lifespan,
)

setup_security_middleware(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "https://threadseeker.pages.dev",
        "https://*.pages.dev",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Groq-API-Key"],
    max_age=3600,
)


# ---------------------------------------------------------------------------
# Request/response models for slim endpoints
# ---------------------------------------------------------------------------

class OptimizeQueriesResponse(BaseModel):
    github_query: str
    huggingface_query: str
    reddit_query: str
    intent: Optional[str] = None
    source_weights: Optional[dict[str, float]] = None
    reasoning: Optional[str] = None


class RedditSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    max_results: int = Field(default=10, ge=1, le=30)


class RedditThreadOut(BaseModel):
    title: str
    url: str
    subreddit: str
    score: int = 0
    num_comments: int = 0
    created_utc: Optional[float] = None
    selftext: Optional[str] = None
    community_sentiment: Optional[str] = None
    has_warning: bool = False
    warning_reason: Optional[str] = None


class RedditSearchResponse(BaseModel):
    results: list[RedditThreadOut]


class UnifiedProjectLite(BaseModel):
    source: str
    name: str
    description: Optional[str] = None
    url: str
    stars: int = 0


class SynthesizeRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    projects: list[UnifiedProjectLite] = Field(default_factory=list)


class SynthesizeResponse(BaseModel):
    synthesis: Optional[str] = None


class ExtractRequest(BaseModel):
    urls: list[str] = Field(..., min_length=1, max_length=10)


class ExtractResponse(BaseModel):
    content: dict[str, Optional[str]]


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/", response_model=HealthResponse)
async def root():
    return HealthResponse()


@app.get("/health", response_model=HealthResponse)
async def health_check():
    cache = get_cache()
    return HealthResponse(
        status="healthy",
        message=f"ThreadSeeker running. Cache: {'on' if cache.enabled else 'off'}",
    )


# ---------------------------------------------------------------------------
# Query analysis & optimization
# ---------------------------------------------------------------------------

@app.post("/analyze-query", response_model=QueryRefinementResponse)
async def analyze_query(request: SearchRequest):
    """Check whether a query is too broad and needs clarifying questions."""
    sanitized = QuerySanitizer.sanitize_query(request.query)
    if not QuerySanitizer.validate_query_length(sanitized):
        raise HTTPException(status_code=400, detail="Query must be 3-1000 characters")

    needs_refinement, questions = analyze_query_ambiguity(sanitized)
    return QueryRefinementResponse(
        needs_refinement=needs_refinement,
        original_query=sanitized,
        questions=[q.to_dict() for q in questions],
        message=(
            "Please answer these to get better results"
            if needs_refinement
            else "Query is clear"
        ),
    )


@app.post("/optimize-queries", response_model=OptimizeQueriesResponse)
async def optimize_queries(
    request: SearchRequest,
    x_groq_api_key: Optional[str] = Header(None),
):
    """Turn a natural-language query into per-platform optimized queries."""
    sanitized = QuerySanitizer.sanitize_query(request.query)
    if not QuerySanitizer.validate_query_length(sanitized):
        raise HTTPException(status_code=400, detail="Query must be 3-1000 characters")

    api_key = None
    if x_groq_api_key:
        clean_key = APIKeyValidator.sanitize_key(x_groq_api_key)
        if not APIKeyValidator.validate_groq_key(clean_key):
            raise HTTPException(status_code=400, detail="Invalid API key format")
        api_key = clean_key

    query_to_optimize = sanitized
    if request.refinement_answers:
        query_to_optimize = refine_query_with_answers(sanitized, request.refinement_answers)

    cache = get_cache()
    cache_key = f"opt:{query_to_optimize}"
    cached = await cache.get("optimize", cache_key)
    if cached:
        return OptimizeQueriesResponse(**cached)

    generated = await generate_search_queries(query_to_optimize, api_key=api_key)

    payload = OptimizeQueriesResponse(
        github_query=generated.github_query,
        huggingface_query=generated.huggingface_query,
        reddit_query=generated.reddit_query,
        intent=generated.intent,
        source_weights=generated.source_weights,
        reasoning=generated.reasoning,
    )
    await cache.set("optimize", cache_key, payload.model_dump(), ttl_seconds=600)
    return payload


# ---------------------------------------------------------------------------
# Reddit search (frontend cannot reach Reddit directly — CORS)
# ---------------------------------------------------------------------------

@app.post("/search-reddit", response_model=RedditSearchResponse)
async def search_reddit_endpoint(request: RedditSearchRequest):
    """Search Reddit via DuckDuckGo + .json hack. Runs sentiment analysis on threads."""
    sanitized = QuerySanitizer.sanitize_query(request.query)
    if not QuerySanitizer.validate_query_length(sanitized):
        raise HTTPException(status_code=400, detail="Query must be 3-1000 characters")

    cache = get_cache()
    cache_key = f"reddit:{sanitized}:{request.max_results}"
    cached = await cache.get("reddit", cache_key)
    if cached:
        return RedditSearchResponse(**cached)

    try:
        threads = await search_reddit(sanitized, max_results=request.max_results)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Reddit search failed: {e}")

    threads = rank_reddit_results(threads, sanitized)

    out = [
        RedditThreadOut(
            title=t.title,
            url=t.url,
            subreddit=t.subreddit,
            score=t.score,
            num_comments=t.num_comments,
            created_utc=t.created_utc,
            selftext=t.selftext,
            community_sentiment=(
                t.community_sentiment.value if t.community_sentiment else None
            ),
            has_warning=t.has_warning,
            warning_reason=t.warning_reason,
        )
        for t in threads
    ]
    payload = RedditSearchResponse(results=out)
    await cache.set("reddit", cache_key, payload.model_dump(), ttl_seconds=600)
    return payload


# ---------------------------------------------------------------------------
# AI synthesis across a unified project list
# ---------------------------------------------------------------------------

@app.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize(
    request: SynthesizeRequest,
    x_groq_api_key: Optional[str] = Header(None),
):
    """Summarize a list of multi-source project results for the user."""
    if not request.projects:
        return SynthesizeResponse(synthesis=None)

    sanitized = QuerySanitizer.sanitize_query(request.query)
    if not QuerySanitizer.validate_query_length(sanitized):
        raise HTTPException(status_code=400, detail="Query must be 3-1000 characters")

    api_key = None
    if x_groq_api_key:
        clean_key = APIKeyValidator.sanitize_key(x_groq_api_key)
        if not APIKeyValidator.validate_groq_key(clean_key):
            raise HTTPException(status_code=400, detail="Invalid API key format")
        api_key = clean_key

    # Bucket into the shapes ai_logic expects
    gh_results: list[GitHubResult] = []
    hf_results: list[HuggingFaceResult] = []
    reddit_results: list[RedditResult] = []

    for p in request.projects[:20]:
        if p.source in ("github", "gitlab", "codeberg"):
            gh_results.append(
                GitHubResult(
                    title=p.name,
                    url=p.url,
                    description=p.description,
                    stars=p.stars,
                )
            )
        elif p.source == "huggingface":
            hf_results.append(
                HuggingFaceResult(
                    title=p.name,
                    url=p.url,
                    description=p.description,
                )
            )
        elif p.source == "reddit":
            reddit_results.append(
                RedditResult(
                    title=p.name,
                    url=p.url,
                    subreddit=p.name,
                    selftext=p.description,
                )
            )
        else:
            gh_results.append(
                GitHubResult(
                    title=f"[{p.source}] {p.name}",
                    url=p.url,
                    description=p.description,
                    stars=p.stars,
                )
            )

    synthesis = await synthesize_results(
        user_query=sanitized,
        github_results=gh_results,
        huggingface_results=hf_results,
        reddit_results=reddit_results,
        api_key=api_key,
    )
    return SynthesizeResponse(synthesis=synthesis)


# ---------------------------------------------------------------------------
# Content extraction (Trafilatura — Python-only)
# ---------------------------------------------------------------------------

@app.post("/extract-content", response_model=ExtractResponse)
async def extract_content(request: ExtractRequest):
    """Fetch and extract clean main-content text from URLs using Trafilatura."""
    clean_urls = [u for u in request.urls if u.startswith(("http://", "https://"))][:10]
    if not clean_urls:
        raise HTTPException(status_code=400, detail="No valid URLs provided")

    content = await extract_multiple_urls(clean_urls, max_concurrent=3)
    return ExtractResponse(content=content)


@app.get("/ai-status")
async def ai_status():
    """Report which AI providers the server has keys for."""
    return {
        "groq": bool(get_groq_client()),
        "gemini": bool(get_gemini_model()),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
