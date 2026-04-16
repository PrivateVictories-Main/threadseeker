"""Reddit search via DuckDuckGo + .json thread enrichment.

This is the only search the backend handles — every other source (GitHub,
HuggingFace, GitLab, npm, PyPI, crates.io, HN, Codeberg, Packagist,
RubyGems) is called directly from the frontend browser.

Reddit is here because reddit.com blocks browser-to-browser CORS.
"""
import asyncio
import random
import re
from typing import Optional

import httpx
from ddgs import DDGS

from config import get_settings
from models import RedditResult, RedditComment, SentimentType

settings = get_settings()


def _user_agent() -> str:
    return random.choice(settings.user_agents)


def _headers() -> dict:
    return {
        "User-Agent": _user_agent(),
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    }


def _ddg_search(query: str, max_results: int, time_filter: str = "w") -> list[dict]:
    try:
        return list(DDGS().text(query, max_results=max_results, timelimit=time_filter))
    except Exception as e:
        print(f"DuckDuckGo search error: {e}")
        return []


# ---------------------------------------------------------------------------
# Sentiment analysis
# ---------------------------------------------------------------------------

NEGATIVE_PATTERNS = [
    r"\bdoesn'?t work\b", r"\bbroken\b", r"\bdeprecated\b", r"\babandoned\b",
    r"\bdon'?t use\b", r"\bwaste of time\b", r"\bterrible\b", r"\bhorrible\b",
    r"\bgarbage\b", r"\buseless\b", r"\bscam\b", r"\bbug(?:gy|s)\b",
    r"\bnot maintained\b", r"\bno longer works\b", r"\bdead project\b",
]

POSITIVE_PATTERNS = [
    r"\bworks great\b", r"\bhighly recommend\b", r"\bamazing\b",
    r"\bexcellent\b", r"\bperfect\b", r"\bawesome\b", r"\blove (?:it|this)\b",
    r"\bbest\b", r"\bfantastic\b",
]


def analyze_sentiment(text: str) -> tuple[SentimentType, Optional[str]]:
    text_lower = text.lower()

    neg_matches = [
        m.group()
        for p in NEGATIVE_PATTERNS
        if (m := re.search(p, text_lower))
    ]
    pos_count = sum(1 for p in POSITIVE_PATTERNS if re.search(p, text_lower))

    if len(neg_matches) >= 2:
        return SentimentType.NEGATIVE, f"Community concerns: {', '.join(neg_matches[:3])}"
    if neg_matches and pos_count == 0:
        return SentimentType.MIXED, f"Mixed feedback: {neg_matches[0]}"
    if pos_count >= 2:
        return SentimentType.POSITIVE, None
    return SentimentType.NEUTRAL, None


# ---------------------------------------------------------------------------
# Reddit search
# ---------------------------------------------------------------------------

async def search_reddit(query: str, max_results: int = 6) -> list[RedditResult]:
    """Search Reddit via DuckDuckGo and enrich via the .json URL hack."""
    post_pattern = re.compile(r"reddit\.com/r/([^/]+)/comments/([^/]+)")

    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(
        None, _ddg_search, f"site:reddit.com {query}", max_results * 4
    )

    filtered: list[dict] = []
    seen: set[str] = set()

    for r in raw:
        url = r.get("href", "")
        if "/user/" in url or "/u/" in url:
            continue
        if not post_pattern.search(url):
            continue
        base = url.split("#")[0].split("?")[0]
        if base not in seen:
            seen.add(base)
            r_copy = r.copy()
            r_copy["href"] = base
            filtered.append(r_copy)
            if len(filtered) >= max_results * 2:
                break

    async with httpx.AsyncClient(timeout=settings.request_timeout) as client:
        tasks = [_fetch_thread(client, r) for r in filtered]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    return [r for r in results if isinstance(r, RedditResult)][: max_results * 2]


async def _fetch_thread(client: httpx.AsyncClient, result: dict) -> RedditResult:
    url = result.get("href", "")
    title = result.get("title", "Reddit Discussion")

    sub_match = re.search(r"reddit\.com/r/([^/]+)/", url)
    subreddit = sub_match.group(1) if sub_match else "unknown"

    title = re.sub(r"\s*:\s*r/\w+\s*$", "", title)
    title = re.sub(r"\s*[-–]\s*Reddit\s*$", "", title)

    rr = RedditResult(title=title, url=url, subreddit=subreddit)

    try:
        json_url = f"{url.split('?')[0].rstrip('/')}.json"
        resp = await client.get(json_url, headers=_headers(), follow_redirects=True)
        if resp.status_code != 200:
            rr.preview_available = False
            return rr

        data = resp.json()
        if not isinstance(data, list) or len(data) < 1:
            return rr

        post_children = data[0].get("data", {}).get("children", [])
        if post_children:
            post = post_children[0].get("data", {})
            rr.score = post.get("score", 0)
            rr.num_comments = post.get("num_comments", 0)
            rr.created_utc = post.get("created_utc")
            rr.selftext = (post.get("selftext", "")[:500] or None)

        if len(data) >= 2:
            comments_data = data[1].get("data", {}).get("children", [])
            all_text: list[str] = []
            top_comments: list[RedditComment] = []

            for c in comments_data[:10]:
                if c.get("kind") != "t1":
                    continue
                cd = c.get("data", {})
                body = cd.get("body", "")
                score = cd.get("score", 0)
                author = cd.get("author", "[deleted]")

                if body and body not in ("[deleted]", "[removed]"):
                    all_text.append(body)
                    sentiment, _ = analyze_sentiment(body)
                    if len(top_comments) < 3 and score > 0:
                        top_comments.append(
                            RedditComment(
                                author=author,
                                score=score,
                                body=body[:300],
                                sentiment=sentiment,
                            )
                        )

            rr.top_comments = top_comments
            overall, warning = analyze_sentiment(" ".join(all_text))
            rr.community_sentiment = overall
            if overall in (SentimentType.NEGATIVE, SentimentType.MIXED):
                rr.has_warning = True
                rr.warning_reason = warning

    except Exception as e:
        print(f"Reddit fetch error for {url}: {e}")
        rr.preview_available = False

    return rr
