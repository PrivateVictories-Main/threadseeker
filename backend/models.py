"""Pydantic models for API requests and responses."""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """User's search query input."""
    query: str = Field(..., min_length=3, max_length=1000, description="The project idea to search for")


class SourceType(str, Enum):
    """Type of source for a search result."""
    GITHUB = "github"
    HUGGINGFACE = "huggingface"
    REDDIT = "reddit"


class ProjectStatus(str, Enum):
    """Status of a GitHub project."""
    ACTIVE = "active"
    MAINTAINED = "maintained"
    STALE = "stale"
    ABANDONED = "abandoned"
    UNKNOWN = "unknown"


class SentimentType(str, Enum):
    """Sentiment analysis result for community feedback."""
    POSITIVE = "positive"
    MIXED = "mixed"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


class GitHubResult(BaseModel):
    """A GitHub repository result."""
    source: SourceType = SourceType.GITHUB
    title: str
    url: str
    description: Optional[str] = None
    stars: Optional[int] = None
    language: Optional[str] = None
    last_updated: Optional[str] = None
    status: ProjectStatus = ProjectStatus.UNKNOWN
    clone_command: Optional[str] = None
    readme_preview: Optional[str] = None
    topics: list[str] = Field(default_factory=list)


class HuggingFaceResult(BaseModel):
    """A Hugging Face model/space result."""
    source: SourceType = SourceType.HUGGINGFACE
    title: str
    url: str
    description: Optional[str] = None
    model_type: Optional[str] = None
    downloads: Optional[int] = None
    likes: Optional[int] = None
    spaces_url: Optional[str] = None
    pipeline_tag: Optional[str] = None


class RedditComment(BaseModel):
    """A notable comment from a Reddit thread."""
    author: str
    score: int
    body: str
    sentiment: SentimentType = SentimentType.NEUTRAL


class RedditResult(BaseModel):
    """A Reddit thread result."""
    source: SourceType = SourceType.REDDIT
    title: str
    url: str
    subreddit: str
    score: int = 0
    num_comments: int = 0
    created_utc: Optional[float] = None
    selftext: Optional[str] = None
    top_comments: list[RedditComment] = Field(default_factory=list)
    community_sentiment: SentimentType = SentimentType.NEUTRAL
    has_warning: bool = False
    warning_reason: Optional[str] = None
    preview_available: bool = True


class GeneratedQueries(BaseModel):
    """AI-generated search queries optimized for each platform."""
    github_query: str
    huggingface_query: str
    reddit_query: str
    reasoning: Optional[str] = None


class SearchResults(BaseModel):
    """Combined search results from all sources."""
    github: list[GitHubResult] = Field(default_factory=list)
    huggingface: list[HuggingFaceResult] = Field(default_factory=list)
    reddit: list[RedditResult] = Field(default_factory=list)
    generated_queries: Optional[GeneratedQueries] = None
    synthesis: Optional[str] = None
    search_duration_ms: int = 0
    errors: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)

