"""ThreadSeeker V2 - The Autonomous Research Engine API with Zero-Cost Scaling."""
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from ai_logic import generate_search_queries, synthesize_results, merge_and_prioritize_results
from models import (
    HealthResponse,
    SearchRequest,
    SearchResults,
)
from search_logic import execute_parallel_search
from ranking import rank_github_results, rank_huggingface_results, rank_reddit_results
from cache import get_cache
from content_extractor import extract_multiple_urls


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("🚀 ThreadSeeker V2 API starting...")
    print("🔄 Initializing cache...")
    cache = get_cache()
    print(f"✅ Cache status: {'enabled' if cache.enabled else 'disabled'}")
    yield
    print("👋 ThreadSeeker V2 API shutting down...")


app = FastAPI(
    title="ThreadSeeker V2 API",
    description="The Autonomous Research Engine - Real-time, zero-cost search across GitHub, Hugging Face, and Reddit.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "*",  # Allow all for Vercel deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=HealthResponse)
async def root():
    """Health check endpoint."""
    return HealthResponse()


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    cache = get_cache()
    return HealthResponse(
        status="healthy",
        message=f"ThreadSeeker V2 is running! Cache: {'enabled' if cache.enabled else 'disabled'}"
    )


@app.post("/search", response_model=SearchResults)
async def search(request: SearchRequest, x_groq_api_key: Optional[str] = Header(None)):
    """
    Execute a comprehensive parallel search across GitHub, HuggingFace, and Reddit.
    
    V2 Features:
    - Real-time content extraction from top results
    - Redis caching for infinite scaling (10-minute TTL)
    - Groq -> Gemini AI fallback
    - Time-filtered searches for maximum freshness
    
    Optional Header:
    - X-Groq-API-Key: User's Groq API key for faster AI processing
    """
    start_time = time.time()
    cache = get_cache()
    
    # Check cache first
    cache_key = f"{request.query}:{x_groq_api_key[:8] if x_groq_api_key else 'default'}"
    cached_result = await cache.get("search", cache_key)
    
    if cached_result:
        print(f"🎯 Returning cached results for: {request.query}")
        # Update timing to reflect cache hit speed
        cached_result["search_duration_ms"] = int((time.time() - start_time) * 1000)
        return SearchResults(**cached_result)
    
    try:
        # Step 1: Generate optimized search queries using AI (with optional user API key)
        generated_queries = await generate_search_queries(request.query, api_key=x_groq_api_key)
        
        # Step 2: Execute parallel searches with time filter for freshness
        github_results, hf_results, reddit_results, errors = await execute_parallel_search(
            github_query=generated_queries.github_query,
            huggingface_query=generated_queries.huggingface_query,
            reddit_query=generated_queries.reddit_query,
        )
        
        # Step 2.5: Extract real-time content from top 3 results (if available)
        extracted_content = {}
        urls_to_extract = []
        
        if github_results:
            urls_to_extract.extend([r.url for r in github_results[:2]])
        if hf_results:
            urls_to_extract.extend([r.url for r in hf_results[:1]])
        
        if urls_to_extract:
            print(f"📄 Extracting content from {len(urls_to_extract)} URLs...")
            extracted_content = await extract_multiple_urls(urls_to_extract, max_concurrent=3)
            print(f"✅ Extracted {sum(1 for v in extracted_content.values() if v)} content pieces")
        
        # Step 3: Rank results by relevance
        github_results = rank_github_results(github_results, request.query)
        hf_results = rank_huggingface_results(hf_results, request.query)
        reddit_results = rank_reddit_results(reddit_results, request.query)
        
        # Step 3.5: Intelligently merge and prioritize results based on intent
        intent = generated_queries.intent or "general"
        weights = generated_queries.source_weights or {"github": 0.4, "reddit": 0.4, "huggingface": 0.2}
        prioritized_results = merge_and_prioritize_results(
            github_results=github_results,
            huggingface_results=hf_results,
            reddit_results=reddit_results,
            intent=intent,
            weights=weights
        )
        
        # Step 4: Synthesize results with AI (with optional user API key and extracted content)
        synthesis = await synthesize_results(
            user_query=request.query,
            github_results=github_results,
            huggingface_results=hf_results,
            reddit_results=reddit_results,
            api_key=x_groq_api_key,
            extracted_content=extracted_content if extracted_content else None,
        )
        
        # Calculate duration
        duration_ms = int((time.time() - start_time) * 1000)
        
        result = SearchResults(
            github=github_results,
            huggingface=hf_results,
            reddit=reddit_results,
            generated_queries=generated_queries,
            synthesis=synthesis,
            search_duration_ms=duration_ms,
            errors=errors,
            intent=intent,
            prioritized_results=prioritized_results,
        )
        
        # Cache the result (10 minutes TTL)
        await cache.set("search", cache_key, result.model_dump(), ttl_seconds=600)
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


@app.get("/trending", response_model=SearchResults)
async def get_trending():
    """
    Get trending content across GitHub, HuggingFace, and Reddit.
    Returns curated, up-to-date projects and discussions with aggressive caching.
    Uses static fallback for instant loading while fetching fresh data in background.
    """
    from datetime import datetime
    from static_trending import STATIC_TRENDING
    import asyncio
    
    start_time = time.time()
    cache = get_cache()
    
    # Check cache first (aggressive caching for trending - longer TTL)
    cached_trending = await cache.get("trending", "latest")
    
    if cached_trending:
        print("🎯 Returning cached trending content")
        cached_trending["search_duration_ms"] = int((time.time() - start_time) * 1000)
        return SearchResults(**cached_trending)
    
    # Check if we have static data as fallback
    try:
        # Parse static data into proper models
        from models import GitHubResult, HuggingFaceResult, RedditResult, RedditComment
        
        github_static = [GitHubResult(**item) for item in STATIC_TRENDING["github"]]
        hf_static = [HuggingFaceResult(**item) for item in STATIC_TRENDING["huggingface"]]
        reddit_static = []
        for item in STATIC_TRENDING["reddit"]:
            reddit_data = item.copy()
            if reddit_data.get("top_comments"):
                reddit_data["top_comments"] = [RedditComment(**c) for c in reddit_data["top_comments"]]
            reddit_static.append(RedditResult(**reddit_data))
        
        # Return static data immediately
        static_result = SearchResults(
            github=github_static,
            huggingface=hf_static,
            reddit=reddit_static,
            generated_queries=None,
            synthesis=f"Explore trending projects, models, and discussions. Loading fresh data...",
            search_duration_ms=int((time.time() - start_time) * 1000),
            errors=[]
        )
        
        # Cache static data briefly (1 minute) so repeated calls are instant
        await cache.set("trending", "latest", static_result.model_dump(), ttl_seconds=60)
        
        # Start background task to fetch real data (don't await)
        asyncio.create_task(fetch_and_cache_real_trending())
        
        return static_result
        
    except Exception as e:
        print(f"⚠️ Static fallback failed: {e}")
    
    # If static fails, fetch real data (slow but reliable)
    return await fetch_real_trending()


async def fetch_and_cache_real_trending():
    """Background task to fetch real trending data and cache it."""
    try:
        result = await fetch_real_trending()
        cache = get_cache()
        # Cache for 30 minutes
        await cache.set("trending", "latest", result.model_dump(), ttl_seconds=1800)
        print("✅ Background: Fresh trending data cached")
    except Exception as e:
        print(f"⚠️ Background trending fetch failed: {e}")


async def fetch_real_trending() -> SearchResults:
    """Fetch real trending data from APIs."""
    from datetime import datetime
    
    start_time = time.time()
    
    try:
        current_year = datetime.now().year
        current_month = datetime.now().strftime("%B")
        
        # Trending searches optimized for each platform with time filters
        # Use fewer results for faster loading
        github_results, hf_results, reddit_results, errors = await execute_parallel_search(
            github_query=f"stars:>500 pushed:>{current_year}-01-01",
            huggingface_query=f"trending most-downloaded",
            reddit_query=f"site:reddit.com/r/programming OR site:reddit.com/r/webdev {current_year}",
        )
        
        # Filter out flagged Reddit posts from trending
        reddit_results = [r for r in reddit_results if not r.has_warning]
        
        # Take top results only for speed
        github_results = github_results[:6]
        hf_results = hf_results[:6]
        reddit_results = reddit_results[:6]
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        return SearchResults(
            github=github_results,
            huggingface=hf_results,
            reddit=reddit_results,
            generated_queries=None,
            synthesis=f"Explore trending projects, models, and discussions from {current_month} {current_year}. Updated in real-time.",
            search_duration_ms=duration_ms,
            errors=errors,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch trending content: {str(e)}"
        )


@app.get("/test-search")
async def test_search():
    """Test endpoint to verify search functionality."""
    from search_logic import search_github, search_huggingface, search_reddit
    
    results = {
        "github": [],
        "huggingface": [],
        "reddit": [],
    }
    
    try:
        github = await search_github("voice changer python", max_results=2)
        results["github"] = [r.model_dump() for r in github]
    except Exception as e:
        results["github_error"] = str(e)
    
    try:
        hf = await search_huggingface("voice conversion", max_results=2)
        results["huggingface"] = [r.model_dump() for r in hf]
    except Exception as e:
        results["huggingface_error"] = str(e)
    
    try:
        reddit = await search_reddit("best voice changer software", max_results=2)
        results["reddit"] = [r.model_dump() for r in reddit]
    except Exception as e:
        results["reddit_error"] = str(e)
    
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
