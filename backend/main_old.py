"""ThreadSeeker - The Autonomous Research Engine API."""
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from ai_logic import generate_search_queries, synthesize_results
from models import (
    HealthResponse,
    SearchRequest,
    SearchResults,
)
from search_logic import execute_parallel_search
from ranking import rank_github_results, rank_huggingface_results, rank_reddit_results


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("🚀 ThreadSeeker API starting...")
    yield
    print("👋 ThreadSeeker API shutting down...")


app = FastAPI(
    title="ThreadSeeker API",
    description="The Autonomous Research Engine - Find code, models, and community validation for your project ideas.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
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
    return HealthResponse()


@app.post("/search", response_model=SearchResults)
async def search(request: SearchRequest, x_groq_api_key: Optional[str] = Header(None)):
    """
    Execute a comprehensive parallel search across GitHub, HuggingFace, and Reddit.
    
    The search process:
    1. Use AI to generate optimized queries for each platform
    2. Execute all searches in parallel
    3. Synthesize results with AI-powered verdict
    
    Optional Header:
    - X-Groq-API-Key: User's Groq API key for faster AI processing
    """
    start_time = time.time()
    
    try:
        # Step 1: Generate optimized search queries using AI (with optional user API key)
        generated_queries = await generate_search_queries(request.query, api_key=x_groq_api_key)
        
        # Step 2: Execute parallel searches
        github_results, hf_results, reddit_results, errors = await execute_parallel_search(
            github_query=generated_queries.github_query,
            huggingface_query=generated_queries.huggingface_query,
            reddit_query=generated_queries.reddit_query,
        )
        
        # Step 2.5: Rank results by relevance
        github_results = rank_github_results(github_results, request.query)
        hf_results = rank_huggingface_results(hf_results, request.query)
        reddit_results = rank_reddit_results(reddit_results, request.query)
        
        # Step 3: Synthesize results with AI (with optional user API key)
        synthesis = await synthesize_results(
            user_query=request.query,
            github_results=github_results,
            huggingface_results=hf_results,
            reddit_results=reddit_results,
            api_key=x_groq_api_key,
        )
        
        # Calculate duration
        duration_ms = int((time.time() - start_time) * 1000)
        
        return SearchResults(
            github=github_results,
            huggingface=hf_results,
            reddit=reddit_results,
            generated_queries=generated_queries,
            synthesis=synthesis,
            search_duration_ms=duration_ms,
            errors=errors,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


@app.get("/trending", response_model=SearchResults)
async def get_trending():
    """
    Get trending content across GitHub, HuggingFace, and Reddit.
    Returns curated, up-to-date projects and discussions.
    """
    from datetime import datetime
    
    start_time = time.time()
    
    try:
        current_year = datetime.now().year
        
        # Trending searches optimized for each platform
        github_results, hf_results, reddit_results, errors = await execute_parallel_search(
            github_query=f"trending {current_year} stars:>100",
            huggingface_query=f"trending {current_year} most downloaded",
            reddit_query=f"programming {current_year} trending hot",
        )
        
        # Filter out flagged Reddit posts from trending
        reddit_results = [r for r in reddit_results if not r.has_warning]
        
        # Take top results only
        github_results = github_results[:6]
        hf_results = hf_results[:6]
        reddit_results = reddit_results[:6]
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        return SearchResults(
            github=github_results,
            huggingface=hf_results,
            reddit=reddit_results,
            generated_queries=None,
            synthesis="Explore trending projects, models, and discussions from the development community.",
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

