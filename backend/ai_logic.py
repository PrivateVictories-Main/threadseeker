"""AI integration with Groq (primary) and Gemini (fallback) for intelligent query generation and synthesis."""
import json
import re
from typing import Optional, Literal
from datetime import datetime

from groq import Groq
import google.generativeai as genai

from config import get_settings
from models import (
    GeneratedQueries,
    GitHubResult,
    HuggingFaceResult,
    RedditResult,
)

settings = get_settings()

# Query intent types
QueryIntent = Literal[
    "project_search",      # Looking for existing projects/code
    "how_to",              # Tutorial/guide questions
    "recommendation",      # Asking for suggestions/best practices
    "comparison",          # Comparing technologies
    "troubleshooting",     # Problem-solving/debugging
    "model_search",        # Looking for AI models
    "general"              # General inquiry
]


# Configure Gemini if available
if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)


def get_groq_client(api_key: Optional[str] = None) -> Optional[Groq]:
    """Get Groq client if API key is configured (user's key takes priority)."""
    if api_key:
        return Groq(api_key=api_key)
    if settings.groq_api_key:
        return Groq(api_key=settings.groq_api_key)
    return None


def get_gemini_model() -> Optional[any]:
    """Get Gemini model if API key is configured."""
    if settings.gemini_api_key:
        try:
            return genai.GenerativeModel('gemini-1.5-flash')
        except Exception as e:
            print(f"⚠️ Gemini initialization error: {e}")
    return None


def classify_query_intent(user_query: str) -> tuple[QueryIntent, dict[str, float]]:
    """
    Classify the user's query intent to determine optimal source prioritization.
    
    Returns:
        tuple: (primary_intent, source_weights)
        source_weights example: {"github": 0.6, "reddit": 0.3, "huggingface": 0.1}
    """
    query_lower = user_query.lower()
    
    # Pattern matching for intent classification
    project_patterns = [
        r'\b(project|repo|repository|code|implementation|example|template|boilerplate)\b',
        r'\b(github|clone|fork|open[- ]source)\b',
        r'\b(does .+ exist|is there a|find .+ project)\b',
    ]
    
    how_to_patterns = [
        r'\bhow (to|do|can)\b',
        r'\bwhat is the (best )?(way|method|approach)\b',
        r'\b(guide|tutorial|steps|learn|build|create|make|setup)\b',
        r'\bcan (i|you|we)\b',
    ]
    
    recommendation_patterns = [
        r'\b(best|top|recommend|suggestion|should i|which|better|vs)\b',
        r'\b(what .+ use|what .+ choose)\b',
    ]
    
    comparison_patterns = [
        r'\bvs\.?\b|\bversus\b',
        r'\b(compare|comparison|difference between|which is better)\b',
    ]
    
    troubleshooting_patterns = [
        r'\b(error|issue|problem|bug|fix|broken|not working|help|solve)\b',
        r'\b(why .+ not|how to fix|debugging)\b',
    ]
    
    model_patterns = [
        r'\b(model|llm|transformer|neural network|ai model|ml model)\b',
        r'\b(gpt|bert|llama|mistral|stable diffusion|clip)\b',
        r'\b(hugging ?face|hf|pretrained)\b',
    ]
    
    # Score each intent
    scores = {
        "project_search": sum(1 for p in project_patterns if re.search(p, query_lower, re.IGNORECASE)),
        "how_to": sum(1 for p in how_to_patterns if re.search(p, query_lower, re.IGNORECASE)),
        "recommendation": sum(1 for p in recommendation_patterns if re.search(p, query_lower, re.IGNORECASE)),
        "comparison": sum(1 for p in comparison_patterns if re.search(p, query_lower, re.IGNORECASE)),
        "troubleshooting": sum(1 for p in troubleshooting_patterns if re.search(p, query_lower, re.IGNORECASE)),
        "model_search": sum(1 for p in model_patterns if re.search(p, query_lower, re.IGNORECASE)),
    }
    
    # Determine primary intent
    max_score = max(scores.values())
    if max_score == 0:
        intent = "general"
    else:
        intent = max(scores, key=scores.get)
    
    # Define source weights based on intent
    weight_mappings = {
        "project_search": {"github": 0.7, "reddit": 0.2, "huggingface": 0.1},
        "how_to": {"reddit": 0.6, "github": 0.3, "huggingface": 0.1},
        "recommendation": {"reddit": 0.6, "github": 0.25, "huggingface": 0.15},
        "comparison": {"reddit": 0.5, "github": 0.3, "huggingface": 0.2},
        "troubleshooting": {"reddit": 0.7, "github": 0.2, "huggingface": 0.1},
        "model_search": {"huggingface": 0.7, "github": 0.2, "reddit": 0.1},
        "general": {"github": 0.4, "reddit": 0.4, "huggingface": 0.2},
    }
    
    weights = weight_mappings.get(intent, weight_mappings["general"])
    
    print(f"🎯 Query intent: {intent} | Weights: GitHub {weights['github']:.0%}, Reddit {weights['reddit']:.0%}, HF {weights['huggingface']:.0%}")
    
    return intent, weights


def merge_and_prioritize_results(
    github_results: list[GitHubResult],
    huggingface_results: list[HuggingFaceResult],
    reddit_results: list[RedditResult],
    intent: QueryIntent,
    weights: dict[str, float]
) -> list[dict]:
    """
    Intelligently merge and prioritize results based on query intent.
    
    Creates a unified ranked list where:
    - Results are scored based on source weights
    - Top results from each source can be interleaved
    - Quality signals (stars, votes, recency) boost scores
    
    Returns:
        List of dicts with: {source, data, score, rank}
    """
    merged = []
    
    # Score GitHub results
    for idx, result in enumerate(github_results):
        base_score = weights["github"] * 100
        
        # Boost for quality signals
        if result.stars:
            star_boost = min(result.stars / 1000, 20)  # Cap at 20 points
            base_score += star_boost
        
        # Boost for active projects
        status_boosts = {
            "active": 15,
            "maintained": 10,
            "stale": -5,
            "abandoned": -15,
        }
        base_score += status_boosts.get(result.status.value, 0)
        
        # Penalty for lower rank
        base_score -= idx * 2
        
        merged.append({
            "source": "github",
            "data": result.model_dump(),
            "score": base_score,
            "original_rank": idx + 1
        })
    
    # Score HuggingFace results
    for idx, result in enumerate(huggingface_results):
        base_score = weights["huggingface"] * 100
        
        # Boost for popularity
        if result.likes:
            like_boost = min(result.likes / 100, 15)
            base_score += like_boost
        
        if result.downloads:
            download_boost = min(result.downloads / 10000, 15)
            base_score += download_boost
        
        # Penalty for lower rank
        base_score -= idx * 2
        
        merged.append({
            "source": "huggingface",
            "data": result.model_dump(),
            "score": base_score,
            "original_rank": idx + 1
        })
    
    # Score Reddit results
    for idx, result in enumerate(reddit_results):
        base_score = weights["reddit"] * 100
        
        # Boost for engagement
        if result.score:
            vote_boost = min(result.score / 100, 15)
            base_score += vote_boost
        
        if result.num_comments:
            comment_boost = min(result.num_comments / 50, 10)
            base_score += comment_boost
        
        # Penalty for warnings
        if result.has_warning:
            base_score -= 20
        
        # Boost for positive sentiment
        if result.community_sentiment.value == "positive":
            base_score += 10
        elif result.community_sentiment.value == "negative":
            base_score -= 10
        
        # Penalty for lower rank
        base_score -= idx * 2
        
        merged.append({
            "source": "reddit",
            "data": result.model_dump(),
            "score": base_score,
            "original_rank": idx + 1
        })
    
    # Sort by score (descending)
    merged.sort(key=lambda x: x["score"], reverse=True)
    
    # Add final rank
    for idx, item in enumerate(merged):
        item["rank"] = idx + 1
    
    print(f"🔄 Merged {len(merged)} results | Top 3: {[f'{m['source']}({m['score']:.1f})' for m in merged[:3]]}")
    
    return merged


async def generate_search_queries(user_query: str, api_key: Optional[str] = None, extracted_content: Optional[dict] = None) -> GeneratedQueries:
    """
    Use AI (Groq primary, Gemini fallback) to convert user's natural language 
    into optimized search queries for each platform.
    Also classifies query intent for intelligent result prioritization.
    
    Args:
        user_query: The user's search query
        api_key: Optional user-provided API key (takes priority over settings)
        extracted_content: Optional dict of extracted content from URLs for context
    """
    # Classify intent first
    intent, weights = classify_query_intent(user_query)
    
    current_year = datetime.now().year
    current_month = datetime.now().strftime("%B %Y")
    
    # Try Groq first (primary)
    client = get_groq_client(api_key)
    
    if client:
        try:
            prompt = _build_query_prompt(user_query, current_year, current_month, extracted_content, intent)
            
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
                    reasoning=data.get("reasoning", "Generated by Groq AI"),
                    intent=intent,
                    source_weights=weights,
                )
        except Exception as e:
            print(f"⚠️ Groq query generation failed: {e}")
            print("🔄 Switching to Gemini fallback...")
    
    # Try Gemini fallback
    gemini_model = get_gemini_model()
    if gemini_model:
        try:
            prompt = _build_query_prompt(user_query, current_year, current_month, extracted_content, intent)
            
            response = gemini_model.generate_content(prompt)
            content = response.text.strip()
            
            # Parse JSON from response
            json_match = re.search(r'\{[^{}]*\}', content, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                print("✅ Gemini fallback successful")
                return GeneratedQueries(
                    github_query=data.get("github_query", user_query),
                    huggingface_query=data.get("huggingface_query", user_query),
                    reddit_query=data.get("reddit_query", user_query),
                    reasoning=data.get("reasoning", "Generated by Gemini AI (fallback)"),
                    intent=intent,
                    source_weights=weights,
                )
        except Exception as e:
            print(f"⚠️ Gemini fallback also failed: {e}")
    
    # Ultimate fallback - rule-based
    fallback = _generate_fallback_queries(user_query, current_year)
    fallback.intent = intent
    fallback.source_weights = weights
    return fallback


async def synthesize_results(
    user_query: str,
    github_results: list[GitHubResult],
    huggingface_results: list[HuggingFaceResult],
    reddit_results: list[RedditResult],
    api_key: Optional[str] = None,
    extracted_content: Optional[dict] = None,
) -> str:
    """
    Use AI (Groq primary, Gemini fallback) to synthesize a comprehensive verdict 
    from all search results and extracted content.
    
    Args:
        user_query: The user's search query
        github_results: GitHub search results
        huggingface_results: HuggingFace search results
        reddit_results: Reddit search results
        api_key: Optional user-provided API key (takes priority over settings)
        extracted_content: Optional dict of extracted content from URLs
    """
    # Try Groq first (primary)
    client = get_groq_client(api_key)
    
    if client:
        try:
            prompt = _build_synthesis_prompt(user_query, github_results, huggingface_results, reddit_results, extracted_content)
            
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[
                    {"role": "system", "content": "You are a real-time technical research advisor. Synthesize findings to provide actionable insights. Emphasize how recent the information is."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=300,
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"⚠️ Groq synthesis failed: {e}")
            print("🔄 Switching to Gemini fallback...")
    
    # Try Gemini fallback
    gemini_model = get_gemini_model()
    if gemini_model:
        try:
            prompt = _build_synthesis_prompt(user_query, github_results, huggingface_results, reddit_results, extracted_content)
            
            response = gemini_model.generate_content(prompt)
            print("✅ Gemini fallback successful")
            return response.text.strip()
            
        except Exception as e:
            print(f"⚠️ Gemini fallback also failed: {e}")
    
    # Ultimate fallback
    return _generate_fallback_synthesis(github_results, huggingface_results, reddit_results)


def _build_query_prompt(user_query: str, current_year: int, current_month: str, extracted_content: Optional[dict], intent: QueryIntent) -> str:
    """Build the prompt for query generation with intent awareness."""
    content_context = ""
    if extracted_content:
        content_context = f"\n\nREAL-TIME CONTEXT FROM WEB:\n"
        for url, text in list(extracted_content.items())[:2]:
            if text:
                content_context += f"- {text[:300]}...\n"
    
    intent_guidance = {
        "project_search": "Focus on finding concrete implementations and code examples. Prioritize GitHub.",
        "how_to": "Focus on tutorials, guides, and discussions. Prioritize Reddit and GitHub examples.",
        "recommendation": "Focus on community opinions and comparisons. Prioritize Reddit.",
        "comparison": "Focus on detailed comparisons and benchmarks. Balance Reddit and GitHub.",
        "troubleshooting": "Focus on solutions and discussions. Prioritize Reddit.",
        "model_search": "Focus on AI models and pretrained weights. Prioritize HuggingFace.",
        "general": "Balance all sources equally.",
    }
    
    guidance = intent_guidance.get(intent, intent_guidance["general"])
    
    return f"""You are a search optimization expert focused on finding THE MOST RECENT information. Today is {current_month}.

USER'S QUERY: "{user_query}"
DETECTED INTENT: {intent}
STRATEGY: {guidance}{content_context}

Generate search queries optimized for:
1. **GitHub** - Focus on: exact technical terms, primary libraries/frameworks, programming language. MUST include "{current_year}" or "recent" or "latest" for fresh projects.
2. **Hugging Face** - Focus on: specific model types, task names (e.g., "text-generation", "image-classification"), architecture names. MUST include "{current_year}" or "latest".
3. **Reddit** - Focus on: recent discussions. MUST include "{current_year}" or "recent" for latest info, plus keywords like "best", "recommendation", "current".

CRITICAL RULES:
- ALWAYS include "{current_year}" OR "recent" OR "latest" in EVERY query for maximum freshness
- Use time filter parameters when possible (e.g., "time:week", "time:month")
- Prioritize ACTIVELY MAINTAINED and RECENTLY UPDATED projects
- Use exact technical terminology
- Keep each query under 60 characters

Respond ONLY in this exact JSON format:
{{
    "github_query": "your github optimized query with {current_year}/recent",
    "huggingface_query": "your huggingface optimized query with {current_year}/latest", 
    "reddit_query": "your reddit optimized query with {current_year}/recent",
    "reasoning": "brief explanation emphasizing recency focus"
}}"""


def _build_synthesis_prompt(
    user_query: str,
    github_results: list[GitHubResult],
    huggingface_results: list[HuggingFaceResult],
    reddit_results: list[RedditResult],
    extracted_content: Optional[dict]
) -> str:
    """Build the prompt for synthesis."""
    # Prepare context
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
    
    content_context = ""
    if extracted_content:
        content_context = f"\n\nREAL-TIME CONTENT EXTRACTED FROM TOP RESULTS:\n"
        for url, text in list(extracted_content.items())[:3]:
            if text:
                content_context += f"- {text[:400]}...\n"
    
    return f"""You are a technical research advisor helping a developer find existing solutions using REAL-TIME data.

USER'S QUERY: "{user_query}"

NOTE: This search was intelligently prioritized based on query intent. Results are ranked by relevance and quality.

GITHUB REPOSITORIES FOUND (ranked):
{chr(10).join(github_context) if github_context else "No repositories found."}

HUGGING FACE MODELS/SPACES FOUND (ranked):
{chr(10).join(hf_context) if hf_context else "No models found."}

REDDIT COMMUNITY DISCUSSIONS (ranked):
{chr(10).join(reddit_context) if reddit_context else "No discussions found."}{content_context}

Based on these REAL-TIME, intelligently-ranked findings, provide a concise verdict (3-4 sentences max):
1. Is there a strong existing solution the user can build upon?
2. What's the recommended starting point from the TOP-RANKED results?
3. Any important warnings or recent trends from the community?
4. How recent/fresh is this information?

Be direct and actionable. Mention specific dates or time frames when available. Start with the bottom line."""


def _generate_fallback_queries(user_query: str, current_year: int) -> GeneratedQueries:
    """Generate fallback queries when both AIs fail."""
    # Extract technical terms
    words = re.findall(r'\b\w+\b', user_query.lower())
    
    # Add common programming languages if mentioned
    langs = ['python', 'javascript', 'java', 'cpp', 'c++', 'rust', 'go', 'typescript']
    lang_keywords = [w for w in words if w in langs]
    
    # Always add current year for maximum recency
    github_query = f"{user_query} {current_year} {''.join(lang_keywords[:1])}".strip()
    huggingface_query = f"{user_query} {current_year} latest".strip()
    reddit_query = f"{user_query} {current_year} best recommendation recent".strip()
    
    return GeneratedQueries(
        github_query=github_query,
        huggingface_query=huggingface_query,
        reddit_query=reddit_query,
        reasoning=f"Using optimized fallback queries with {current_year} for maximum recency (both AI providers unavailable)",
    )


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
        return "No relevant results found. Try refining your search query with more specific technical terms."
    
    return f"Search complete: {', '.join(parts)}. Review the results below for potential starting points. (Note: AI synthesis unavailable - both Groq and Gemini providers are currently unavailable)"
