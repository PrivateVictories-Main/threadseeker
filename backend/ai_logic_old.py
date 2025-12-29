"""Groq AI integration for intelligent query generation and synthesis."""
import json
import re
from typing import Optional

from groq import Groq

from config import get_settings
from models import (
    GeneratedQueries,
    GitHubResult,
    HuggingFaceResult,
    RedditResult,
    SearchResults,
)

settings = get_settings()


def get_groq_client(api_key: Optional[str] = None) -> Optional[Groq]:
    """Get Groq client if API key is configured (user's key takes priority)."""
    if api_key:
        return Groq(api_key=api_key)
    if settings.groq_api_key:
        return Groq(api_key=settings.groq_api_key)
    return None


async def generate_search_queries(user_query: str, api_key: Optional[str] = None) -> GeneratedQueries:
    """
    Use Groq (Llama 3-8b for speed) to convert user's natural language 
    into optimized search queries for each platform.
    
    Args:
        user_query: The user's search query
        api_key: Optional user-provided API key (takes priority over settings)
    """
    client = get_groq_client(api_key)
    
    if not client:
        # Improved fallback: always include current year for maximum recency
        from datetime import datetime
        current_year = datetime.now().year
        
        # Extract technical terms
        words = re.findall(r'\b\w+\b', user_query.lower())
        
        # Add common programming languages if mentioned
        langs = ['python', 'javascript', 'java', 'cpp', 'c++', 'rust', 'go', 'typescript']
        lang_keywords = [w for w in words if w in langs]
        
        # Always add current year for maximum recency
        github_query = f"{user_query} {current_year} {''.join(lang_keywords[:1])}".strip()
        huggingface_query = f"{user_query} {current_year} latest".strip()
        reddit_query = f"{user_query} {current_year} best recommendation".strip()
        
        return GeneratedQueries(
            github_query=github_query,
            huggingface_query=huggingface_query,
            reddit_query=reddit_query,
            reasoning=f"Using optimized fallback queries with {current_year} for maximum recency",
        )
    
    prompt = f"""You are a search optimization expert. Given a user's project idea, generate 3 highly optimized search queries that will find the MOST RELEVANT and UP-TO-DATE results.

USER'S PROJECT IDEA: "{user_query}"

Generate search queries optimized for:
1. **GitHub** - Focus on: exact technical terms, primary libraries/frameworks, programming language. MUST include "2024" or "2025" for recent projects.
2. **Hugging Face** - Focus on: specific model types, task names (e.g., "text-generation", "image-classification"), architecture names. MUST include "2024" or "2025" or "latest".
3. **Reddit** - Focus on: recent discussions. MUST include "2024" or "2025" for latest info, plus keywords like "best", "recommendation", "current".

CRITICAL RULES:
- ALWAYS include "2024" or "2025" in EVERY query for maximum recency
- Prioritize RECENT, MAINTAINED, and POPULAR projects
- Use exact technical terminology
- Keep each query under 60 characters
- For Reddit, focus on posts from last few months only

Respond ONLY in this exact JSON format:
{{
    "github_query": "your github optimized query with 2024/2025",
    "huggingface_query": "your huggingface optimized query with 2024/2025", 
    "reddit_query": "your reddit optimized query with 2024/2025",
    "reasoning": "brief explanation of your optimization strategy"
}}"""

    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": "You are a search query optimization assistant. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=300,
        )
        
        content = response.choices[0].message.content.strip()
        
        # Parse JSON from response
        json_match = re.search(r'\{[^{}]*\}', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return GeneratedQueries(
                github_query=data.get("github_query", user_query),
                huggingface_query=data.get("huggingface_query", user_query),
                reddit_query=data.get("reddit_query", user_query),
                reasoning=data.get("reasoning"),
            )
    except Exception as e:
        print(f"Query generation error: {e}")
    
    # Fallback
    return GeneratedQueries(
        github_query=user_query,
        huggingface_query=user_query,
        reddit_query=f"{user_query} recommendation",
        reasoning="AI optimization failed - using direct query",
    )


async def synthesize_results(
    user_query: str,
    github_results: list[GitHubResult],
    huggingface_results: list[HuggingFaceResult],
    reddit_results: list[RedditResult],
    api_key: Optional[str] = None,
) -> str:
    """
    Use Groq (Llama 3-70b for quality) to synthesize a comprehensive verdict 
    from all search results.
    
    Args:
        user_query: The user's search query
        github_results: GitHub search results
        huggingface_results: HuggingFace search results
        reddit_results: Reddit search results
        api_key: Optional user-provided API key (takes priority over settings)
    """
    client = get_groq_client(api_key)
    
    if not client:
        return _generate_fallback_synthesis(github_results, huggingface_results, reddit_results)
    
    # Prepare context for the AI
    github_context = []
    for r in github_results[:5]:
        status_emoji = {
            "active": "🟢",
            "maintained": "🟡", 
            "stale": "🟠",
            "abandoned": "🔴",
        }.get(r.status.value, "⚪")
        github_context.append(f"- {r.title} ({status_emoji} {r.status.value}): {r.description or 'No description'}")
    
    hf_context = []
    for r in huggingface_results[:5]:
        hf_context.append(f"- {r.title}: {r.description or 'No description'}")
    
    reddit_context = []
    for r in reddit_results[:5]:
        warning = "⚠️ COMMUNITY WARNING" if r.has_warning else ""
        comments_summary = ""
        if r.top_comments:
            comments_summary = f" | Top comment: '{r.top_comments[0].body[:100]}...'"
        reddit_context.append(f"- r/{r.subreddit}: {r.title} {warning}{comments_summary}")
    
    prompt = f"""You are a technical research advisor helping a developer find existing solutions.

USER'S PROJECT IDEA: "{user_query}"

GITHUB REPOSITORIES FOUND:
{chr(10).join(github_context) if github_context else "No repositories found."}

HUGGING FACE MODELS/SPACES FOUND:
{chr(10).join(hf_context) if hf_context else "No models found."}

REDDIT COMMUNITY DISCUSSIONS:
{chr(10).join(reddit_context) if reddit_context else "No discussions found."}

Based on these findings, provide a concise verdict (3-4 sentences max):
1. Is there a strong existing solution the user can build upon?
2. What's the recommended starting point?
3. Any important warnings from the community?

Be direct and actionable. Start with the bottom line."""

    try:
        response = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": "You are a concise technical advisor. Provide actionable insights in 3-4 sentences."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=250,
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"Synthesis error: {e}")
        return _generate_fallback_synthesis(github_results, huggingface_results, reddit_results)


def _generate_fallback_synthesis(
    github_results: list[GitHubResult],
    huggingface_results: list[HuggingFaceResult],
    reddit_results: list[RedditResult],
) -> str:
    """Generate a basic synthesis when AI is unavailable."""
    parts = []
    
    if github_results:
        active = [r for r in github_results if r.status.value == "active"]
        if active:
            parts.append(f"Found {len(active)} active GitHub repositories")
        else:
            parts.append(f"Found {len(github_results)} GitHub repositories")
    
    if huggingface_results:
        parts.append(f"{len(huggingface_results)} Hugging Face models/spaces")
    
    if reddit_results:
        warnings = [r for r in reddit_results if r.has_warning]
        if warnings:
            parts.append(f"{len(reddit_results)} Reddit discussions ({len(warnings)} with community warnings)")
        else:
            parts.append(f"{len(reddit_results)} Reddit discussions")
    
    if not parts:
        return "No relevant results found. Try refining your search query."
    
    return f"Search complete: {', '.join(parts)}. Review the results below for potential starting points."

