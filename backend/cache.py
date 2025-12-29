"""Redis caching layer using Upstash for zero-cost scaling."""
import hashlib
import json
from typing import Optional, Any
from upstash_redis import Redis

from config import get_settings

settings = get_settings()


class CacheManager:
    """Manages Redis caching with Upstash for infinite scaling."""
    
    def __init__(self):
        """Initialize Redis connection if credentials are available."""
        self.redis: Optional[Redis] = None
        self.enabled = False
        
        if settings.upstash_redis_url and settings.upstash_redis_token:
            try:
                self.redis = Redis(
                    url=settings.upstash_redis_url,
                    token=settings.upstash_redis_token
                )
                self.enabled = True
                print("✅ Redis cache enabled (Upstash)")
            except Exception as e:
                print(f"⚠️ Redis cache disabled: {e}")
                self.enabled = False
        else:
            print("⚠️ Redis cache disabled (no credentials)")
    
    def _generate_key(self, prefix: str, query: str) -> str:
        """Generate a cache key from query."""
        query_hash = hashlib.md5(query.lower().encode()).hexdigest()
        return f"{prefix}:{query_hash}"
    
    async def get(self, prefix: str, query: str) -> Optional[Any]:
        """
        Get cached result.
        
        Args:
            prefix: Cache key prefix (e.g., 'search', 'trending')
            query: The search query or identifier
            
        Returns:
            Cached data if found, None otherwise
        """
        if not self.enabled or not self.redis:
            return None
        
        try:
            key = self._generate_key(prefix, query)
            cached = self.redis.get(key)
            
            if cached:
                print(f"🎯 Cache HIT: {prefix}:{query[:50]}")
                return json.loads(cached)
            
            print(f"❌ Cache MISS: {prefix}:{query[:50]}")
            return None
            
        except Exception as e:
            print(f"⚠️ Cache get error: {e}")
            return None
    
    async def set(self, prefix: str, query: str, data: Any, ttl_seconds: Optional[int] = None) -> bool:
        """
        Set cached result with TTL.
        
        Args:
            prefix: Cache key prefix
            query: The search query or identifier
            data: Data to cache (must be JSON serializable)
            ttl_seconds: Time to live in seconds (default: 600 = 10 minutes)
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled or not self.redis:
            return False
        
        try:
            key = self._generate_key(prefix, query)
            ttl = ttl_seconds or settings.cache_ttl_seconds
            
            # Serialize data
            serialized = json.dumps(data)
            
            # Set with expiration
            self.redis.setex(key, ttl, serialized)
            
            print(f"💾 Cache SET: {prefix}:{query[:50]} (TTL: {ttl}s)")
            return True
            
        except Exception as e:
            print(f"⚠️ Cache set error: {e}")
            return False
    
    async def delete(self, prefix: str, query: str) -> bool:
        """
        Delete cached result.
        
        Args:
            prefix: Cache key prefix
            query: The search query or identifier
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled or not self.redis:
            return False
        
        try:
            key = self._generate_key(prefix, query)
            self.redis.delete(key)
            print(f"🗑️ Cache DELETE: {prefix}:{query[:50]}")
            return True
            
        except Exception as e:
            print(f"⚠️ Cache delete error: {e}")
            return False


# Singleton instance
_cache_manager: Optional[CacheManager] = None


def get_cache() -> CacheManager:
    """Get the singleton cache manager instance."""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = CacheManager()
    return _cache_manager
