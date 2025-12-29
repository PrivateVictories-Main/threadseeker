"""Core search logic with parallel execution for GitHub, HuggingFace, and Reddit."""
import asyncio
import random
import re
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote_plus, urlparse

import httpx
from bs4 import BeautifulSoup
from ddgs import DDGS

from config import get_settings
from models import (
    GitHubResult,
    HuggingFaceResult,
    RedditResult,
    RedditComment,
    ProjectStatus,
    SentimentType,
)

settings = get_settings()


def get_random_user_agent() -> str:
    """Get a random user agent for request rotation."""
    return random.choice(settings.user_agents)


def get_headers() -> dict:
    """Get request headers with rotated user agent."""
    return {
        "User-Agent": get_random_user_agent(),
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    }


def run_ddg_search(query: str, max_results: int) -> list[dict]:
    """Run DuckDuckGo search synchronously."""
    try:
        ddgs = DDGS()
        results = list(ddgs.text(query, max_results=max_results))
        return results
    except Exception as e:
        print(f"DuckDuckGo search error: {e}")
        return []


# ============================================================================
# GitHub Search & Parsing
# ============================================================================

async def search_github(query: str, max_results: int = 8) -> list[GitHubResult]:
    """Search GitHub via DuckDuckGo and enrich with metadata."""
    results = []
    
    try:
        # Run search in thread pool to avoid blocking
        # Fetch 5x the results to ensure we get enough recent, quality ones after filtering
        loop = asyncio.get_event_loop()
        search_results = await loop.run_in_executor(
            None, 
            run_ddg_search, 
            f"site:github.com {query}",
            max_results * 5  # Increased from 3x to 5x for better filtering
        )
        
        # Filter to actual repo pages (not issues, pulls, wikis, etc.)
        repo_pattern = re.compile(r"github\.com/([^/]+)/([^/]+)/?$")
        filtered = []
        seen_repos = set()
        
        for r in search_results:
            url = r.get("href", "")
            # More comprehensive filtering
            if (repo_pattern.search(url) and 
                "/blob/" not in url and 
                "/tree/" not in url and
                "/issues/" not in url and
                "/pull/" not in url and
                "/wiki/" not in url and
                "/discussions/" not in url and
                "/actions/" not in url):
                
                # Extract repo identifier to avoid duplicates
                match = repo_pattern.search(url)
                if match:
                    repo_id = f"{match.group(1)}/{match.group(2)}".lower()
                    if repo_id not in seen_repos:
                        seen_repos.add(repo_id)
                        filtered.append(r)
                        
                        if len(filtered) >= max_results * 2:
                            break
        
        # Fetch README previews in parallel
        async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
            tasks = [enrich_github_result(client, r, query) for r in filtered]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
        # Filter out exceptions and limit to max_results
        results = [r for r in results if isinstance(r, GitHubResult)][:max_results * 2]
        
    except Exception as e:
        print(f"GitHub search error: {e}")
    
    return results


async def enrich_github_result(client: httpx.AsyncClient, result: dict, query: str = "") -> GitHubResult:
    """Enrich a GitHub search result with additional metadata."""
    url = result.get("href", "")
    title = result.get("title", "Unknown Repository")
    description = result.get("body", "")
    
    # Parse owner/repo from URL
    match = re.search(r"github\.com/([^/]+)/([^/]+)", url)
    owner, repo = match.groups() if match else ("", "")
    
    # Clean up title
    title = re.sub(r"\s*[-·]\s*GitHub.*$", "", title).strip()
    if not title:
        title = f"{owner}/{repo}" if owner and repo else "Unknown"
    
    # Initialize result
    github_result = GitHubResult(
        title=title,
        url=url.rstrip("/"),
        description=description[:300] if description else None,
        clone_command=f"git clone https://github.com/{owner}/{repo}.git" if owner and repo else None,
    )
    
    # Try to fetch README preview
    if owner and repo:
        try:
            readme_url = f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md"
            response = await client.get(readme_url, headers=get_headers())
            
            if response.status_code == 404:
                readme_url = f"https://raw.githubusercontent.com/{owner}/{repo}/master/README.md"
                response = await client.get(readme_url, headers=get_headers())
            
            if response.status_code == 200:
                readme_content = response.text[:1500]
                # Clean up markdown
                readme_preview = re.sub(r"[#*`\[\]]", "", readme_content)
                readme_preview = re.sub(r"\n{3,}", "\n\n", readme_preview)
                github_result.readme_preview = readme_preview[:500]
        except Exception:
            pass
        
        # Try to get repo metadata from API-less page scraping
        try:
            response = await client.get(url, headers=get_headers())
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "lxml")
                
                # Extract stars from meta tags or page content
                stars_elem = soup.select_one("[id='repo-stars-counter-star']")
                if stars_elem:
                    stars_text = stars_elem.get("title", stars_elem.text).replace(",", "")
                    try:
                        github_result.stars = int(float(stars_text.replace("k", "000").replace("K", "000")))
                    except ValueError:
                        pass
                
                # Extract language
                lang_elem = soup.select_one("[data-ga-click*='language']") or soup.select_one(".BorderGrid-cell .Progress + ul li a")
                if lang_elem:
                    github_result.language = lang_elem.text.strip()
                
                # Extract topics
                topic_elems = soup.select("a[data-octo-click='topic_click']")
                github_result.topics = [t.text.strip() for t in topic_elems[:5]]
                
                # Check for activity status
                time_elem = soup.select_one("relative-time")
                if time_elem and time_elem.get("datetime"):
                    try:
                        last_update = datetime.fromisoformat(time_elem["datetime"].replace("Z", "+00:00"))
                        github_result.last_updated = time_elem["datetime"]
                        github_result.status = determine_project_status(last_update)
                    except Exception:
                        pass
                        
        except Exception:
            pass
    
    return github_result


def determine_project_status(last_update: datetime) -> ProjectStatus:
    """Determine project status based on last update time."""
    now = datetime.now(last_update.tzinfo) if last_update.tzinfo else datetime.utcnow()
    age = now - last_update
    
    if age < timedelta(days=30):
        return ProjectStatus.ACTIVE
    elif age < timedelta(days=180):
        return ProjectStatus.MAINTAINED
    elif age < timedelta(days=365):
        return ProjectStatus.STALE
    else:
        return ProjectStatus.ABANDONED


# ============================================================================
# Hugging Face Search & Parsing
# ============================================================================

async def search_huggingface(query: str, max_results: int = 6) -> list[HuggingFaceResult]:
    """Search Hugging Face via DuckDuckGo."""
    results = []
    
    try:
        # Run search in thread pool, fetch more results
        loop = asyncio.get_event_loop()
        search_results = await loop.run_in_executor(
            None,
            run_ddg_search,
            f"site:huggingface.co {query}",
            max_results * 3
        )
        
        # Filter to model/space pages (not blog posts, docs, etc.)
        hf_pattern = re.compile(r"huggingface\.co/([^/]+/[^/]+|spaces/[^/]+/[^/]+)/?$")
        
        seen_urls = set()
        for r in search_results:
            url = r.get("href", "")
            
            # Skip blog, docs, and other non-model pages
            if ("/blog" in url or "/docs" in url or "/posts" in url or 
                "/datasets" not in url and "/models" not in url and "/spaces" not in url):
                # Only include direct model/space URLs
                if not hf_pattern.search(url):
                    continue
            
            if url not in seen_urls:
                seen_urls.add(url)
                
                title = r.get("title", "").replace(" | Hugging Face", "").replace(" - Hugging Face", "").strip()
                description = r.get("body", "")
                
                # Determine if it's a space
                is_space = "/spaces/" in url.lower()
                spaces_url = url if is_space else None
                
                # Try to determine pipeline tag from URL or description
                pipeline_tag = None
                model_type = None
                
                # Common pipeline tags
                pipeline_tags = [
                    "text-generation", "text2text-generation", "text-classification",
                    "token-classification", "question-answering", "summarization",
                    "translation", "conversational",
                    "image-classification", "image-segmentation", "object-detection",
                    "image-to-text", "text-to-image", "image-to-image",
                    "audio-classification", "audio-to-audio", "automatic-speech-recognition",
                    "text-to-speech", "voice-activity-detection",
                    "zero-shot-classification", "feature-extraction"
                ]
                
                desc_lower = description.lower()
                url_lower = url.lower()
                
                for tag in pipeline_tags:
                    tag_search = tag.replace("-", " ")
                    if tag_search in desc_lower or tag in url_lower:
                        pipeline_tag = tag
                        break
                
                results.append(HuggingFaceResult(
                    title=title or "Unknown Model",
                    url=url,
                    description=description[:300] if description else None,
                    model_type=model_type,
                    pipeline_tag=pipeline_tag,
                    spaces_url=spaces_url,
                ))
                
                if len(results) >= max_results * 2:
                    break
                    
    except Exception as e:
        print(f"HuggingFace search error: {e}")
    
    return results[:max_results * 2]


# ============================================================================
# Reddit Search & Parsing
# ============================================================================

# Negative sentiment indicators for community warnings
NEGATIVE_PATTERNS = [
    r"\bdoesn'?t work\b",
    r"\bbroken\b",
    r"\bdeprecated\b",
    r"\babandoned\b",
    r"\bdon'?t use\b",
    r"\bwaste of time\b",
    r"\bterrible\b",
    r"\bhorrible\b",
    r"\bgarbage\b",
    r"\buseless\b",
    r"\bscam\b",
    r"\bbug(?:gy|s)\b",
    r"\bnot maintained\b",
    r"\bno longer works\b",
    r"\bdead project\b",
]

POSITIVE_PATTERNS = [
    r"\bworks great\b",
    r"\bhighly recommend\b",
    r"\bamazing\b",
    r"\bexcellent\b",
    r"\bperfect\b",
    r"\bawesome\b",
    r"\blove (?:it|this)\b",
    r"\bbest\b",
    r"\bfantastic\b",
]


def analyze_sentiment(text: str) -> tuple[SentimentType, Optional[str]]:
    """Analyze text for sentiment and return warning reason if negative."""
    text_lower = text.lower()
    
    negative_matches = []
    positive_count = 0
    
    for pattern in NEGATIVE_PATTERNS:
        if re.search(pattern, text_lower):
            match = re.search(pattern, text_lower)
            if match:
                negative_matches.append(match.group())
    
    for pattern in POSITIVE_PATTERNS:
        if re.search(pattern, text_lower):
            positive_count += 1
    
    if len(negative_matches) >= 2:
        return SentimentType.NEGATIVE, f"Community concerns: {', '.join(negative_matches[:3])}"
    elif negative_matches and positive_count == 0:
        return SentimentType.MIXED, f"Mixed feedback: {negative_matches[0]}"
    elif positive_count >= 2:
        return SentimentType.POSITIVE, None
    else:
        return SentimentType.NEUTRAL, None


async def search_reddit(query: str, max_results: int = 6) -> list[RedditResult]:
    """Search Reddit via DuckDuckGo and fetch thread data via .json hack."""
    results = []
    
    try:
        # Run search in thread pool, fetch more results
        loop = asyncio.get_event_loop()
        search_results = await loop.run_in_executor(
            None,
            run_ddg_search,
            f"site:reddit.com {query}",
            max_results * 4  # Fetch extra since some may be comments/invalid
        )
        
        # Filter to actual post pages (not comment pages or user pages)
        post_pattern = re.compile(r"reddit\.com/r/([^/]+)/comments/([^/]+)")
        
        filtered = []
        seen_urls = set()
        
        for r in search_results:
            url = r.get("href", "")
            
            # Skip user pages, subreddit pages without specific posts
            if "/user/" in url or "/u/" in url:
                continue
            
            match = post_pattern.search(url)
            if match:
                # Create normalized URL (remove comment fragment)
                base_url = url.split("#")[0].split("?")[0]
                
                if base_url not in seen_urls:
                    seen_urls.add(base_url)
                    r_copy = r.copy()
                    r_copy["href"] = base_url
                    filtered.append(r_copy)
                    
                    if len(filtered) >= max_results * 2:
                        break
        
        # Fetch thread JSON data in parallel
        async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
            tasks = [fetch_reddit_thread(client, r) for r in filtered]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions and limit
        results = [r for r in results if isinstance(r, RedditResult)][:max_results * 2]
        
    except Exception as e:
        print(f"Reddit search error: {e}")
    
    return results


async def fetch_reddit_thread(client: httpx.AsyncClient, result: dict) -> RedditResult:
    """Fetch Reddit thread data using the .json URL hack."""
    url = result.get("href", "")
    title = result.get("title", "Reddit Discussion")
    
    # Extract subreddit from URL
    subreddit_match = re.search(r"reddit\.com/r/([^/]+)/", url)
    subreddit = subreddit_match.group(1) if subreddit_match else "unknown"
    
    # Clean title
    title = re.sub(r"\s*:\s*r/\w+\s*$", "", title)
    title = re.sub(r"\s*[-–]\s*Reddit\s*$", "", title)
    
    reddit_result = RedditResult(
        title=title,
        url=url,
        subreddit=subreddit,
    )
    
    # Try to fetch JSON data
    try:
        # Clean URL and add .json
        clean_url = url.split("?")[0].rstrip("/")
        json_url = f"{clean_url}.json"
        
        response = await client.get(json_url, headers=get_headers(), follow_redirects=True)
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, list) and len(data) >= 1:
                # First element is the post
                post_data = data[0].get("data", {}).get("children", [])
                if post_data:
                    post = post_data[0].get("data", {})
                    reddit_result.score = post.get("score", 0)
                    reddit_result.num_comments = post.get("num_comments", 0)
                    reddit_result.created_utc = post.get("created_utc")
                    reddit_result.selftext = (post.get("selftext", "")[:500] or None)
                
                # Second element contains comments
                if len(data) >= 2:
                    comments_data = data[1].get("data", {}).get("children", [])
                    
                    all_comment_text = []
                    top_comments = []
                    
                    for comment in comments_data[:10]:
                        if comment.get("kind") != "t1":
                            continue
                        
                        comment_data = comment.get("data", {})
                        body = comment_data.get("body", "")
                        score = comment_data.get("score", 0)
                        author = comment_data.get("author", "[deleted]")
                        
                        if body and body != "[deleted]" and body != "[removed]":
                            all_comment_text.append(body)
                            
                            sentiment, _ = analyze_sentiment(body)
                            
                            if len(top_comments) < 3 and score > 0:
                                top_comments.append(RedditComment(
                                    author=author,
                                    score=score,
                                    body=body[:300],
                                    sentiment=sentiment,
                                ))
                    
                    reddit_result.top_comments = top_comments
                    
                    # Analyze overall sentiment from all comments
                    combined_text = " ".join(all_comment_text)
                    overall_sentiment, warning_reason = analyze_sentiment(combined_text)
                    reddit_result.community_sentiment = overall_sentiment
                    
                    if overall_sentiment in [SentimentType.NEGATIVE, SentimentType.MIXED]:
                        reddit_result.has_warning = True
                        reddit_result.warning_reason = warning_reason
        else:
            reddit_result.preview_available = False
            
    except Exception as e:
        print(f"Reddit fetch error for {url}: {e}")
        reddit_result.preview_available = False
    
    return reddit_result


# ============================================================================
# Search Orchestrator - Parallel Execution
# ============================================================================

async def execute_parallel_search(
    github_query: str,
    huggingface_query: str,
    reddit_query: str,
) -> tuple[list[GitHubResult], list[HuggingFaceResult], list[RedditResult], list[str]]:
    """Execute all searches in parallel and return combined results."""
    errors = []
    
    # Create tasks for parallel execution
    github_task = asyncio.create_task(search_github(github_query))
    huggingface_task = asyncio.create_task(search_huggingface(huggingface_query))
    reddit_task = asyncio.create_task(search_reddit(reddit_query))
    
    # Wait for all tasks
    github_results, hf_results, reddit_results = await asyncio.gather(
        github_task,
        huggingface_task,
        reddit_task,
        return_exceptions=True
    )
    
    # Handle exceptions
    if isinstance(github_results, Exception):
        errors.append(f"GitHub search failed: {str(github_results)}")
        github_results = []
    
    if isinstance(hf_results, Exception):
        errors.append(f"HuggingFace search failed: {str(hf_results)}")
        hf_results = []
    
    if isinstance(reddit_results, Exception):
        errors.append(f"Reddit search failed: {str(reddit_results)}")
        reddit_results = []
    
    return github_results, hf_results, reddit_results, errors
