"""NYT RSS crawler (stub). Add NYT RSS feed URL in config to enable."""
from typing import List

from app.models import Article

# Add to RSS_FEEDS_BY_CATEGORY in config, e.g. "Tin Mỹ": ["https://rss.nytimes.com/..."]
# Then implement fetch via base_rss.fetch_feed.


def crawl_nyt() -> List[Article]:
    """Crawl NYT feeds. Currently returns empty list until feed URLs are configured."""
    return []
