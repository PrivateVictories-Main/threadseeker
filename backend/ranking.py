"""Relevance ranking for Reddit search results.

GitHub, HuggingFace, and other sources are ranked client-side by the
frontend's calculateRelevanceScore(). The backend only ranks Reddit
because it's the only source the backend searches.
"""
import math
import re
from datetime import datetime
from typing import List

from models import RedditResult


def _extract_keywords(query: str) -> List[str]:
    stopwords = {
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
        "be", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "must", "can", "this", "that",
        "these", "those", "i", "you", "he", "she", "it", "we", "they",
        "using", "use", "make", "build", "create", "app", "application", "tool",
    }
    words = re.findall(r"\b\w+\b", query.lower())
    kw = [w for w in words if w not in stopwords and len(w) > 2]
    bigrams = [f"{kw[i]} {kw[i+1]}" for i in range(len(kw) - 1)]
    return kw + bigrams


def _extract_intent(query: str) -> dict:
    q = query.lower()
    words = q.split()

    phrases = []
    for i in range(len(words)):
        if i + 2 < len(words):
            phrases.append(" ".join(words[i : i + 3]))
        if i + 1 < len(words):
            phrases.append(" ".join(words[i : i + 2]))

    languages = [l for l in ["python", "javascript", "typescript", "java", "c++", "cpp", "rust", "go", "ruby", "php", "swift", "kotlin"] if l in q]
    technologies = [t for t in ["react", "vue", "angular", "django", "flask", "fastapi", "express", "nextjs", "tensorflow", "pytorch", "opencv", "numpy"] if t in q]
    tasks = [t for t in ["classification", "detection", "generation", "segmentation", "translation", "recognition", "prediction", "analysis", "optimization"] if t in q]

    words_cleaned = [w for w in words if not re.match(r"^\d{4}$", w) and w not in ("latest", "new", "recent")]

    return {
        "phrases": phrases,
        "languages": languages,
        "technologies": technologies,
        "tasks": tasks,
        "all_words": words_cleaned,
        "original": q,
    }


def _semantic_score(text: str, intent: dict) -> float:
    if not text:
        return 0.0
    t = text.lower()
    score = 0.0

    for phrase in intent["phrases"]:
        if phrase in t:
            score += len(phrase.split()) * 15.0

    for tech in intent["technologies"]:
        if tech in t:
            score += 12.0 + (t.count(tech) - 1) * 3.0

    for lang in intent["languages"]:
        if lang in t:
            score += 10.0

    for task in intent["tasks"]:
        if task in t:
            score += 10.0

    matched = sum(1 for w in intent["all_words"] if len(w) > 3 and w in t)
    score += matched * 2.0

    density = sum(1 for p in intent["phrases"][:3] if p in t)
    density += sum(1 for tech in intent["technologies"] if tech in t)
    if density >= 3:
        score *= 1.5
    elif density >= 2:
        score *= 1.3

    return score


def _score_reddit(result: RedditResult, query: str) -> float:
    intent = _extract_intent(query)
    score = 0.0

    score += _semantic_score(result.title, intent) * 8.0
    if intent["original"] in result.title.lower():
        score += 30.0

    if result.selftext:
        score += _semantic_score(result.selftext, intent) * 10.0

    comments_text = ""
    if result.top_comments:
        comments_text = " ".join(c.body for c in result.top_comments[:5])
        score += _semantic_score(comments_text, intent) * 12.0

    all_content = f"{result.title} {result.selftext or ''} {comments_text}".lower()
    unique = 0
    if intent["languages"] and any(l in all_content for l in intent["languages"]):
        unique += 1
    if intent["technologies"] and any(t in all_content for t in intent["technologies"]):
        unique += 1
    if intent["tasks"] and any(t in all_content for t in intent["tasks"]):
        unique += 1
    if unique >= 3:
        score *= 2.0
    elif unique >= 2:
        score *= 1.6

    if result.score > 0:
        score += math.log10(result.score + 1) * 1.5
        if result.score > 1000:
            score *= 1.6
        elif result.score > 100:
            score *= 1.3

    if result.num_comments > 0:
        score += math.log10(result.num_comments + 1)
        if result.num_comments > 100:
            score *= 1.3

    if result.created_utc:
        try:
            age_days = (datetime.now().timestamp() - result.created_utc) / 86400
            if age_days < 7:
                score *= 3.0
            elif age_days < 30:
                score *= 2.2
            elif age_days < 90:
                score *= 1.7
            elif age_days < 365:
                score *= 1.2
            elif age_days > 730:
                score *= 0.2
        except Exception:
            pass

    if result.has_warning:
        score *= 0.4

    tech_subs = {
        "programming": 1.5, "machinelearning": 1.5, "deeplearning": 1.5,
        "learnprogramming": 1.4, "python": 1.4, "javascript": 1.4,
        "webdev": 1.4, "gamedev": 1.4, "datascience": 1.5,
        "opensource": 1.4, "rust": 1.4, "golang": 1.4, "typescript": 1.4,
    }
    sub = result.subreddit.lower()
    for name, mult in tech_subs.items():
        if name in sub:
            score *= mult
            break

    if not result.selftext and not result.top_comments:
        score *= 0.6

    return score


def rank_reddit_results(results: List[RedditResult], query: str) -> List[RedditResult]:
    if not results:
        return results
    scored = [((_score_reddit(r, query), r)) for r in results]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored]
