"""Reuters RSS crawler."""
from typing import List

from app.config import RSS_FEEDS_BY_CATEGORY, CRAWL_LIMIT_PER_FEED, CRAWL_FETCH_WINDOW
from app.models import Article
from app.database import get_existing_links
from .base_rss import fetch_feed, take_first_new

CATEGORY = "Reuters World"


def crawl_reuters() -> List[Article]:
    """Crawl Reuters World feed. Per feed: fetch window, then take first N not in DB."""
    articles: List[Article] = []
    for url in RSS_FEEDS_BY_CATEGORY.get(CATEGORY, []):
        raw = fetch_feed(url, CATEGORY, limit=CRAWL_FETCH_WINDOW)
        existing = get_existing_links([a.link for a in raw])
        articles.extend(take_first_new(raw, existing, CRAWL_LIMIT_PER_FEED))
    return articles
