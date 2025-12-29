"""Advanced relevance scoring and ranking for search results."""
import re
from datetime import datetime
from typing import List, Tuple
from collections import Counter

from models import GitHubResult, HuggingFaceResult, RedditResult, ProjectStatus


def extract_keywords(query: str) -> List[str]:
    """Extract important keywords from a query, removing common words."""
    # Common stopwords to ignore
    stopwords = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
        'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
        'using', 'use', 'make', 'build', 'create', 'app', 'application', 'tool',
    }
    
    # Extract words, convert to lowercase
    words = re.findall(r'\b\w+\b', query.lower())
    
    # Filter out stopwords and very short words
    keywords = [w for w in words if w not in stopwords and len(w) > 2]
    
    # Add multi-word phrases (like "voice changer", "deep learning")
    bigrams = []
    for i in range(len(keywords) - 1):
        bigram = f"{keywords[i]} {keywords[i+1]}"
        bigrams.append(bigram)
    
    return keywords + bigrams


def extract_intent_keywords(query: str) -> dict:
    """
    Advanced query analysis to extract user intent beyond simple keywords.
    Returns categorized keywords for smarter matching.
    """
    query_lower = query.lower()
    
    # Extract multi-word phrases (highest value)
    phrases = []
    words = query_lower.split()
    for i in range(len(words)):
        if i + 2 < len(words):
            phrases.append(' '.join(words[i:i+3]))  # 3-word phrases
        if i + 1 < len(words):
            phrases.append(' '.join(words[i:i+2]))  # 2-word phrases
    
    # Programming languages
    languages = ['python', 'javascript', 'typescript', 'java', 'c++', 'cpp', 'rust', 'go', 'ruby', 'php', 'swift', 'kotlin']
    detected_langs = [lang for lang in languages if lang in query_lower]
    
    # Technologies/frameworks
    techs = ['react', 'vue', 'angular', 'django', 'flask', 'fastapi', 'express', 'nextjs', 'tensorflow', 'pytorch', 'opencv', 'numpy']
    detected_techs = [tech for tech in techs if tech in query_lower]
    
    # Task types
    tasks = ['classification', 'detection', 'generation', 'segmentation', 'translation', 'recognition', 'prediction', 'analysis', 'optimization']
    detected_tasks = [task for task in tasks if task in query_lower]
    
    # Action verbs (what user wants to DO)
    actions = ['build', 'create', 'make', 'implement', 'develop', 'train', 'deploy', 'optimize', 'convert', 'transform', 'process', 'analyze']
    detected_actions = [action for action in actions if action in query_lower]
    
    # Remove year keywords for intent matching
    words_cleaned = [w for w in words if not re.match(r'^\d{4}$', w) and w not in ['latest', 'new', 'recent']]
    
    return {
        'phrases': phrases,
        'languages': detected_langs,
        'technologies': detected_techs,
        'tasks': detected_tasks,
        'actions': detected_actions,
        'all_words': words_cleaned,
        'original': query_lower
    }


def calculate_semantic_relevance(text: str, intent: dict) -> float:
    """
    Deep semantic matching beyond simple keyword counts.
    Analyzes context, technical alignment, and intent matching.
    """
    if not text:
        return 0.0
    
    text_lower = text.lower()
    score = 0.0
    
    # Multi-word phrase matching (HIGHEST value - shows exact intent)
    for phrase in intent['phrases']:
        if phrase in text_lower:
            # Longer phrases = more specific = higher score
            phrase_len = len(phrase.split())
            score += phrase_len * 15.0  # Much higher than individual words
    
    # Technology stack alignment
    for tech in intent['technologies']:
        if tech in text_lower:
            score += 12.0  # Tech match is very important
            # Bonus if mentioned multiple times
            count = text_lower.count(tech)
            if count > 1:
                score += (count - 1) * 3.0
    
    # Language match
    for lang in intent['languages']:
        if lang in text_lower:
            score += 10.0
    
    # Task type match
    for task in intent['tasks']:
        if task in text_lower:
            score += 10.0
    
    # Action verb match (indicates purpose alignment)
    for action in intent['actions']:
        if action in text_lower:
            score += 5.0
    
    # Individual word matching (lowest priority)
    matched_words = sum(1 for word in intent['all_words'] if len(word) > 3 and word in text_lower)
    score += matched_words * 2.0
    
    # Context bonus: if multiple intent elements appear near each other
    # This indicates the text is actually ABOUT the user's topic
    intent_density = 0
    for phrase in intent['phrases'][:3]:  # Check top 3 phrases
        if phrase in text_lower:
            intent_density += 1
    for tech in intent['technologies']:
        if tech in text_lower:
            intent_density += 1
    
    if intent_density >= 3:
        score *= 1.5  # Strong context alignment
    elif intent_density >= 2:
        score *= 1.3  # Good context alignment
    
    return score


def score_github_result(result: GitHubResult, query: str, keywords: List[str]) -> float:
    """
    Calculate relevance score for a GitHub result using deep semantic analysis.
    Goes far beyond title matching to understand true relevance.
    """
    score = 0.0
    intent = extract_intent_keywords(query)
    
    # === DEEP CONTENT ANALYSIS ===
    
    # 1. TITLE ANALYSIS - Important but not everything
    title_relevance = calculate_semantic_relevance(result.title, intent)
    score += title_relevance * 8.0  # Reduced from 10.0 - title is important but not dominant
    
    # Exact phrase match in title (still valuable)
    if intent['original'] in result.title.lower():
        score += 30.0  # Reduced from 50.0
    
    # 2. DESCRIPTION ANALYSIS - Very important for understanding purpose
    if result.description:
        desc_relevance = calculate_semantic_relevance(result.description, intent)
        score += desc_relevance * 10.0  # INCREASED - description shows what it actually does
        
        # Multi-phrase match in description (shows comprehensive solution)
        phrase_matches = sum(1 for phrase in intent['phrases'][:5] if phrase in result.description.lower())
        if phrase_matches >= 2:
            score += 25.0  # Strong indicator this is exactly what they want
    
    # 3. README ANALYSIS - Critical for understanding implementation details
    if result.readme_preview:
        readme_relevance = calculate_semantic_relevance(result.readme_preview, intent)
        score += readme_relevance * 12.0  # INCREASED - README shows actual functionality
        
        # Check for technical implementation details matching user's needs
        implementation_keywords = intent['technologies'] + intent['tasks'] + intent['languages']
        impl_matches = sum(1 for kw in implementation_keywords if kw in result.readme_preview.lower())
        score += impl_matches * 8.0  # Bonus for technical alignment
    
    # 4. TOPICS ANALYSIS - Excellent for categorization and exact matching
    if result.topics:
        topics_text = " ".join(result.topics)
        topics_relevance = calculate_semantic_relevance(topics_text, intent)
        score += topics_relevance * 15.0  # VERY HIGH - topics are curated tags
        
        # Exact technology/task in topics = perfect match
        for tech in intent['technologies'] + intent['tasks']:
            if any(tech in topic.lower() for topic in result.topics):
                score += 20.0  # Huge bonus - exact categorization
    
    # 5. LANGUAGE MATCH - Important for implementation
    if result.language and intent['languages']:
        if result.language.lower() in intent['languages']:
            score += 15.0  # Strong match - they want this language
    
    # === HOLISTIC CONTENT ANALYSIS ===
    
    # Check if ALL major intent elements are present across ALL content
    all_content = f"{result.title} {result.description or ''} {result.readme_preview or ''} {' '.join(result.topics)}"
    all_content_lower = all_content.lower()
    
    # Count how many unique intent elements appear
    unique_matches = 0
    if intent['languages']:
        unique_matches += any(lang in all_content_lower for lang in intent['languages'])
    if intent['technologies']:
        unique_matches += any(tech in all_content_lower for tech in intent['technologies'])
    if intent['tasks']:
        unique_matches += any(task in all_content_lower for task in intent['tasks'])
    
    # Comprehensive match bonus (this is EXACTLY what they're looking for)
    if unique_matches >= 3:
        score *= 2.0  # MASSIVE - hits all aspects of their query
    elif unique_matches >= 2:
        score *= 1.6  # Strong - hits multiple aspects
    
    # === QUALITY & RECENCY (existing code) ===
    
    # STARS - Quality indicator (but shouldn't override relevance)
    if result.stars and result.stars > 0:
        import math
        star_bonus = math.log10(result.stars + 1) * 2.0
        score += star_bonus
        
        # High star multipliers (popular = battle-tested)
        if result.stars > 10000:
            score *= 1.5
        elif result.stars > 5000:
            score *= 1.4
        elif result.stars > 1000:
            score *= 1.3
        elif result.stars > 500:
            score *= 1.2
    
    # PROJECT STATUS - CRITICAL for up-to-date requirement
    status_multipliers = {
        ProjectStatus.ACTIVE: 2.0,      # Massive boost - recently updated
        ProjectStatus.MAINTAINED: 1.5,  # Good - regularly updated
        ProjectStatus.STALE: 0.4,       # Heavy penalty - old
        ProjectStatus.ABANDONED: 0.1,   # Extreme penalty - dead project
        ProjectStatus.UNKNOWN: 0.7,     # Moderate penalty
    }
    score *= status_multipliers.get(result.status, 1.0)
    
    # RECENCY - EXTREME priority for "up to date to the second"
    if result.last_updated:
        try:
            from datetime import datetime, timedelta
            last_update = datetime.fromisoformat(result.last_updated.replace("Z", "+00:00"))
            now = datetime.now(last_update.tzinfo) if last_update.tzinfo else datetime.utcnow()
            days_old = (now - last_update).days
            
            # EXTREME recency bonuses - prioritize anything from last few days
            if days_old < 3:
                score *= 3.0  # Last 3 days - MASSIVE boost
            elif days_old < 7:
                score *= 2.5  # Last week - HUGE boost
            elif days_old < 14:
                score *= 2.2  # Last 2 weeks - Very strong boost
            elif days_old < 30:
                score *= 2.0  # Last month - Strong boost
            elif days_old < 60:
                score *= 1.7  # Last 2 months - Good boost
            elif days_old < 90:
                score *= 1.5  # Last quarter - Decent boost
            elif days_old < 180:
                score *= 1.3  # Last 6 months - Moderate boost
            elif days_old < 365:
                score *= 1.1  # Last year - Small boost
            elif days_old > 730:
                score *= 0.3  # Over 2 years - Heavy penalty
            elif days_old > 1095:
                score *= 0.1  # Over 3 years - Extreme penalty (essentially filters out)
        except Exception:
            pass
    
    # Language match bonus (when user specifies a language)
    if result.language and intent['languages']:
        lang_lower = result.language.lower()
        # Check if language is mentioned in query
        if lang_lower in intent['languages']:
            score += 15.0  # Strong match - they want this language
    
    # Penalize results with no description or README (likely incomplete/low quality)
    if not result.description and not result.readme_preview:
        score *= 0.6
    
    return score


def score_huggingface_result(result: HuggingFaceResult, query: str, keywords: List[str]) -> float:
    """
    Calculate relevance score for a Hugging Face result using deep semantic analysis.
    """
    score = 0.0
    intent = extract_intent_keywords(query)
    
    # === DEEP CONTENT ANALYSIS ===
    
    # 1. TITLE ANALYSIS
    title_relevance = calculate_semantic_relevance(result.title, intent)
    score += title_relevance * 8.0
    
    if intent['original'] in result.title.lower():
        score += 30.0
    
    # 2. DESCRIPTION ANALYSIS - Critical for understanding model/space purpose
    if result.description:
        desc_relevance = calculate_semantic_relevance(result.description, intent)
        score += desc_relevance * 12.0  # HIGH - description explains what it does
        
        # Multi-phrase match
        phrase_matches = sum(1 for phrase in intent['phrases'][:5] if phrase in result.description.lower())
        if phrase_matches >= 2:
            score += 25.0
    
    # 3. PIPELINE TAG - EXTREMELY important (exact task classification)
    if result.pipeline_tag:
        pipeline_relevance = calculate_semantic_relevance(result.pipeline_tag.replace("-", " "), intent)
        score += pipeline_relevance * 20.0  # VERY HIGH - pipeline is gold standard
        
        # Exact task match
        for task in intent['tasks']:
            if task in result.pipeline_tag.lower():
                score += 30.0  # Perfect task alignment
    
    # === HOLISTIC ANALYSIS ===
    
    all_content = f"{result.title} {result.description or ''} {result.pipeline_tag or ''}"
    all_content_lower = all_content.lower()
    
    unique_matches = 0
    if intent['tasks']:
        unique_matches += any(task in all_content_lower for task in intent['tasks'])
    if intent['technologies']:
        unique_matches += any(tech in all_content_lower for tech in intent['technologies'])
    
    if unique_matches >= 2:
        score *= 1.8  # Strong comprehensive match
    
    # DOWNLOADS - Quality and popularity indicator
    if result.downloads and result.downloads > 0:
        import math
        download_bonus = math.log10(result.downloads + 1) * 1.5
        score += download_bonus
        
        if result.downloads > 1000000:
            score *= 1.6
        elif result.downloads > 100000:
            score *= 1.5
        elif result.downloads > 10000:
            score *= 1.3
        elif result.downloads > 1000:
            score *= 1.2
    
    # LIKES - Community validation
    if result.likes and result.likes > 0:
        import math
        likes_bonus = math.log10(result.likes + 1) * 1.0  # Increased from 0.6
        score += likes_bonus
        
        if result.likes > 500:
            score *= 1.3
        elif result.likes > 100:
            score *= 1.2  # Increased from 1.15
    
    # SPACES - Interactive demos are very valuable (shows it works)
    if result.spaces_url:
        score *= 1.5  # Significant boost - increased from 1.25
    
    # Penalize models with no description (likely incomplete)
    if not result.description:
        score *= 0.7
    
    return score


def score_reddit_result(result: RedditResult, query: str, keywords: List[str]) -> float:
    """
    Calculate relevance score for a Reddit result using deep semantic analysis.
    Analyzes post content AND community comments for true intent matching.
    """
    score = 0.0
    intent = extract_intent_keywords(query)
    
    # === DEEP CONTENT ANALYSIS ===
    
    # 1. TITLE ANALYSIS
    title_relevance = calculate_semantic_relevance(result.title, intent)
    score += title_relevance * 8.0
    
    if intent['original'] in result.title.lower():
        score += 30.0
    
    # 2. POST CONTENT ANALYSIS - What the user actually wrote about
    if result.selftext:
        text_relevance = calculate_semantic_relevance(result.selftext, intent)
        score += text_relevance * 10.0  # HIGH - shows detailed discussion
        
        # Multi-phrase match indicates detailed relevant discussion
        phrase_matches = sum(1 for phrase in intent['phrases'][:5] if phrase in result.selftext.lower())
        if phrase_matches >= 2:
            score += 20.0
    
    # 3. COMMENTS ANALYSIS - Community insights and real experiences
    if result.top_comments:
        comments_text = " ".join([c.body for c in result.top_comments[:5]])
        comments_relevance = calculate_semantic_relevance(comments_text, intent)
        score += comments_relevance * 12.0  # VERY HIGH - real user experiences
        
        # Check if comments discuss specific technologies/solutions
        solution_mentions = 0
        for tech in intent['technologies'] + intent['tasks']:
            if tech in comments_text.lower():
                solution_mentions += 1
        score += solution_mentions * 8.0  # Bonus for actionable recommendations
    
    # === HOLISTIC ANALYSIS ===
    
    all_content = f"{result.title} {result.selftext or ''} {comments_text if result.top_comments else ''}"
    all_content_lower = all_content.lower()
    
    unique_matches = 0
    if intent['languages']:
        unique_matches += any(lang in all_content_lower for lang in intent['languages'])
    if intent['technologies']:
        unique_matches += any(tech in all_content_lower for tech in intent['technologies'])
    if intent['tasks']:
        unique_matches += any(task in all_content_lower for task in intent['tasks'])
    
    if unique_matches >= 3:
        score *= 2.0  # Comprehensive discussion
    elif unique_matches >= 2:
        score *= 1.6
    
    # UPVOTE SCORE - Community validation (popular = helpful)
    if result.score > 0:
        import math
        score_bonus = math.log10(result.score + 1) * 1.5
        score += score_bonus
        
        if result.score > 1000:
            score *= 1.6
        elif result.score > 500:
            score *= 1.5
        elif result.score > 100:
            score *= 1.3
        elif result.score > 50:
            score *= 1.2
    
    # COMMENT COUNT - More discussion = more information
    if result.num_comments > 0:
        import math
        comments_bonus = math.log10(result.num_comments + 1) * 1.0  # Increased from 0.5
        score += comments_bonus
        
        if result.num_comments > 100:
            score *= 1.3  # New tier
        elif result.num_comments > 50:
            score *= 1.2  # Increased from 1.1
    
    # RECENCY - EXTREME priority for up-to-the-second current information
    if result.created_utc:
        try:
            age_days = (datetime.now().timestamp() - result.created_utc) / 86400
            
            # EXTREME recency bonuses for absolutely current info
            if age_days < 1:
                score *= 4.0  # Last 24 hours - ABSOLUTELY MASSIVE boost
            elif age_days < 3:
                score *= 3.5  # Last 3 days - HUGE boost (very current)
            elif age_days < 7:
                score *= 3.0  # Last week - Very strong boost
            elif age_days < 14:
                score *= 2.5  # Last 2 weeks - Strong boost
            elif age_days < 30:
                score *= 2.2  # Last month - Major boost
            elif age_days < 60:
                score *= 1.9  # Last 2 months - Good boost
            elif age_days < 90:
                score *= 1.7  # Last 3 months - Decent boost
            elif age_days < 180:
                score *= 1.4  # Last 6 months - Moderate boost
            elif age_days < 365:
                score *= 1.2  # Last year - Small boost
            elif age_days > 730:
                score *= 0.2  # Over 2 years - Extreme penalty
            elif age_days > 1095:
                score *= 0.05  # Over 3 years - Nearly filter out (outdated)
        except Exception:
            pass
    
    # WARNING PENALTY - Negative community feedback
    if result.has_warning:
        score *= 0.4  # Heavy penalty - increased from 0.6
    
    # SUBREDDIT RELEVANCE - Tech-focused subs have better info
    tech_subs = {
        'programming': 1.5, 'machinelearning': 1.5, 'deeplearning': 1.5,
        'learnprogramming': 1.4, 'artificial': 1.4, 'python': 1.4,
        'javascript': 1.4, 'webdev': 1.4, 'gamedev': 1.4, 
        'datascience': 1.5, 'computervision': 1.5, 'nlp': 1.5,
        'opensource': 1.4, 'coding': 1.3, 'technology': 1.2, 
        'softwaredevelopment': 1.4, 'rust': 1.4, 'golang': 1.4,
        'cpp': 1.4, 'java': 1.4, 'typescript': 1.4
    }
    
    sub_lower = result.subreddit.lower()
    for sub, multiplier in tech_subs.items():
        if sub in sub_lower:
            score *= multiplier
            break
    
    # Penalize posts with no content
    if not result.selftext and len(result.top_comments) == 0:
        score *= 0.6
    
    return score


def rank_github_results(results: List[GitHubResult], query: str) -> List[GitHubResult]:
    """Rank GitHub results by relevance."""
    if not results:
        return results
    
    keywords = extract_keywords(query)
    
    # Score each result
    scored_results = []
    for result in results:
        score = score_github_result(result, query, keywords)
        scored_results.append((score, result))
    
    # Sort by score (descending)
    scored_results.sort(key=lambda x: x[0], reverse=True)
    
    return [result for score, result in scored_results]


def rank_huggingface_results(results: List[HuggingFaceResult], query: str) -> List[HuggingFaceResult]:
    """Rank Hugging Face results by relevance."""
    if not results:
        return results
    
    keywords = extract_keywords(query)
    
    scored_results = []
    for result in results:
        score = score_huggingface_result(result, query, keywords)
        scored_results.append((score, result))
    
    scored_results.sort(key=lambda x: x[0], reverse=True)
    
    return [result for score, result in scored_results]


def rank_reddit_results(results: List[RedditResult], query: str) -> List[RedditResult]:
    """Rank Reddit results by relevance."""
    if not results:
        return results
    
    keywords = extract_keywords(query)
    
    scored_results = []
    for result in results:
        score = score_reddit_result(result, query, keywords)
        scored_results.append((score, result))
    
    scored_results.sort(key=lambda x: x[0], reverse=True)
    
    return [result for score, result in scored_results]

