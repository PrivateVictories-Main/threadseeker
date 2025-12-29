"""Real-time content extraction using Trafilatura."""
import asyncio
from typing import Optional
import trafilatura
from trafilatura.settings import use_config


# Configure trafilatura for speed
config = use_config()
config.set("DEFAULT", "EXTRACTION_TIMEOUT", "2")


async def extract_content_from_url(url: str, timeout: float = 2.0) -> Optional[str]:
    """
    Extract clean text content from a URL using trafilatura.
    
    Args:
        url: The URL to extract content from
        timeout: Maximum time to wait for extraction (seconds)
        
    Returns:
        Extracted text content, or None if extraction fails
    """
    try:
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        
        # Fetch the URL
        downloaded = await loop.run_in_executor(
            None,
            lambda: trafilatura.fetch_url(url)
        )
        
        if not downloaded:
            return None
        
        # Extract clean text
        text = await loop.run_in_executor(
            None,
            lambda: trafilatura.extract(
                downloaded,
                include_comments=False,
                include_tables=False,
                no_fallback=True,
                config=config
            )
        )
        
        if text:
            # Limit to first 2000 characters for LLM context
            return text[:2000]
        
        return None
        
    except asyncio.TimeoutError:
        print(f"⏱️ Timeout extracting: {url}")
        return None
    except Exception as e:
        print(f"⚠️ Error extracting {url}: {e}")
        return None


async def extract_multiple_urls(urls: list[str], max_concurrent: int = 3) -> dict[str, Optional[str]]:
    """
    Extract content from multiple URLs concurrently.
    
    Args:
        urls: List of URLs to extract
        max_concurrent: Maximum number of concurrent extractions
        
    Returns:
        Dictionary mapping URL to extracted content
    """
    results = {}
    
    # Process in batches to avoid overwhelming the system
    for i in range(0, len(urls), max_concurrent):
        batch = urls[i:i + max_concurrent]
        
        # Create tasks for this batch
        tasks = [
            asyncio.create_task(extract_content_from_url(url))
            for url in batch
        ]
        
        # Wait for all tasks in batch to complete
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Store results
        for url, result in zip(batch, batch_results):
            if isinstance(result, Exception):
                results[url] = None
            else:
                results[url] = result
    
    return results
