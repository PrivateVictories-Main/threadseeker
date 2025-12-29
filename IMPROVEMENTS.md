# ThreadSeeker - Search Accuracy & Ranking Improvements

## Overview
This document describes the enhancements made to improve search result accuracy and relevance ranking in ThreadSeeker.

## Key Improvements

### 1. Advanced Relevance Scoring System (`ranking.py`)

Created a sophisticated scoring algorithm that evaluates search results based on multiple factors:

#### Keyword Extraction & Matching
- **Smart Keyword Detection**: Automatically extracts important keywords from queries, filtering out common stopwords
- **Multi-word Phrase Support**: Detects and scores compound terms (e.g., "voice changer", "deep learning") higher
- **Exact Match Bonuses**: Results containing the exact query phrase get significant score boosts

#### Platform-Specific Scoring

**GitHub Results:**
- **Title Match**: 5x weight (up from 3x) with +10 bonus for exact query matches
- **Description Match**: 3x weight with +5 bonus for exact matches
- **README Content**: 2x weight for relevant content
- **Topics/Tags**: 4x weight - highly specific indicators of project relevance
- **Star Count**: Logarithmic scaling with multipliers:
  - 1,000+ stars: 1.15x multiplier
  - 5,000+ stars: 1.25x multiplier
  - 10,000+ stars: 1.35x multiplier
- **Project Status** (CRITICAL for up-to-date results):
  - Active (updated recently): 1.5x multiplier
  - Maintained: 1.2x multiplier
  - Stale: 0.6x penalty
  - Abandoned: 0.3x heavy penalty
- **Recency Boost**:
  - Updated this week: 1.4x multiplier
  - Updated this month: 1.3x multiplier
  - Updated this quarter: 1.2x multiplier
  - Over 2 years old: 0.7x penalty
- **Language Match**: 1.3x boost when query mentions the programming language

**HuggingFace Results:**
- **Title Match**: 5x weight with +10 exact match bonus
- **Description Match**: 3x weight with +5 exact match bonus
- **Pipeline Tag**: 6x weight (VERY important) with +5 per matching keyword
- **Download Count**: Logarithmic scaling with multipliers:
  - 10,000+ downloads: 1.2x multiplier
  - 100,000+ downloads: 1.3x multiplier
  - 1M+ downloads: 1.4x multiplier
- **Likes**: Community validation bonus
- **Spaces**: 1.25x boost for interactive demos (more useful)

**Reddit Results:**
- **Title Match**: 5x weight with +10 exact match bonus
- **Post Content**: 2.5x weight with +5 exact match bonus
- **Comments**: 2x weight for discussion content
- **Upvote Score**: Logarithmic scaling with multipliers:
  - 100+ upvotes: 1.2x multiplier
  - 500+ upvotes: 1.3x multiplier
  - 1,000+ upvotes: 1.4x multiplier
- **Comment Count**: More discussion = more information
- **Recency** (CRITICAL for up-to-date info):
  - Last week: 1.5x multiplier
  - Last month: 1.4x multiplier
  - Last 3 months: 1.3x multiplier
  - Last 6 months: 1.2x multiplier
  - Last year: 1.1x multiplier
  - Over 2 years: 0.7x penalty
  - Over 3 years: 0.5x penalty
- **Community Warning**: 0.6x penalty for negative sentiment
- **Tech Subreddit Bonus**: 1.1-1.3x for programming-focused communities

### 2. Enhanced Search Filtering

#### GitHub Search Improvements
- **3x Results Fetch**: Fetches 3x the requested results to ensure quality after filtering
- **Comprehensive Filtering**: Excludes:
  - Issues and pull requests
  - Wiki pages
  - Discussions
  - Actions/workflows
  - File/tree views
- **Duplicate Detection**: Prevents the same repository from appearing multiple times
- **Better README Extraction**: Fetches raw content for accurate previews

#### HuggingFace Search Improvements
- **3x Results Fetch**: More results to filter from
- **Content Filtering**: Excludes blog posts, docs, and non-model pages
- **Pipeline Detection**: Comprehensive list of 25+ pipeline tags for better categorization
- **Model Type Inference**: Detects model types from descriptions

#### Reddit Search Improvements
- **4x Results Fetch**: More results since some may be invalid
- **URL Normalization**: Removes duplicate posts with different URLs
- **User/Subreddit Filtering**: Excludes user pages and non-post content
- **JSON Data Enrichment**: Fetches actual post data including comments

### 3. Improved AI Query Generation

Enhanced the prompt for Groq AI to generate better search queries:

- **Recency Focus**: Explicitly asks for "2024" or "2023" in queries to find latest content
- **Technical Precision**: Requests exact technical terminology
- **Maintenance Keywords**: Adds terms like "maintained", "latest", "active"
- **Fallback Intelligence**: When no AI is available, automatically:
  - Extracts programming languages from query
  - Adds "2024" and "latest" keywords
  - Optimizes per-platform

### 4. Integration with Main Search Flow

The ranking system is seamlessly integrated into the search pipeline:

1. **Execute parallel searches** across all platforms
2. **Rank results by relevance** using the scoring algorithm
3. **Return top-ranked results** to the user

## Results

### Before Improvements
- Mixed relevance in results
- Outdated/abandoned projects appearing first
- Generic matches without context
- No consideration for project activity

### After Improvements
- **Highly relevant results** matching user intent
- **Active, maintained projects** prioritized
- **Recent content** (2024/2023) ranked higher
- **Popular, well-documented** projects surfaced first
- **Exact matches** and **technical accuracy** emphasized

## Technical Details

### Dependencies
- No new dependencies required
- Uses built-in Python libraries: `re`, `datetime`, `collections`, `math`

### Performance
- Ranking adds minimal overhead (< 50ms typically)
- Scoring is performed in-memory after search results are fetched
- Parallel search execution remains unchanged

### Maintainability
- Centralized scoring logic in `ranking.py`
- Easy to adjust weights and multipliers
- Clear separation of concerns

## Future Enhancements

Potential areas for further improvement:

1. **Machine Learning**: Train a model on user click-through data
2. **A/B Testing**: Test different scoring weights
3. **Personalization**: Remember user preferences
4. **Semantic Search**: Use embeddings for deeper understanding
5. **Result Diversity**: Ensure variety in programming languages/approaches

## Usage

The ranking system works automatically - no configuration needed. However, developers can adjust scoring weights in `ranking.py` by modifying the multiplier values.

### Example Adjustments

To prioritize recency even more:
```python
# In score_github_result()
if days_old < 7:
    score *= 1.6  # Increased from 1.4
```

To emphasize star count:
```python
# In score_github_result()
if result.stars > 1000:
    score *= 1.3  # Increased from 1.15
```

## Testing

Test the improvements by searching for:
- "python web scraper for amazon products 2024" - Should show recent, active projects
- "real-time voice changer using AI" - Should show popular, maintained projects
- "machine learning image classification" - Should show models with high downloads

Compare the order and relevance of results before and after the improvements.

---

**Last Updated**: December 26, 2024  
**Version**: 1.0  
**Author**: ThreadSeeker Team

