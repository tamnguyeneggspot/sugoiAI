"""Crypto RSS crawler: CoinDesk, Cointelegraph."""
from datetime import datetime
from typing import List

from app.config import RSS_FEEDS_BY_CATEGORY, CRAWL_LIMIT_PER_FEED, CRAWL_FETCH_WINDOW
from app.models import Article
from app.database import get_existing_links
from .base_rss import fetch_feed, take_first_new

CATEGORY = "Crypto"


def _sort_key(a: Article) -> datetime:
    """Dùng để sắp xếp: tin mới nhất trước; không có published thì xếp cuối."""
    return a.published or datetime.min


def crawl_crypto() -> List[Article]:
    """Crawl CoinDesk và Cointelegraph; per feed lấy first N chưa có trong DB, gộp lại, sort và lấy top N."""
    articles: List[Article] = []
    for url in RSS_FEEDS_BY_CATEGORY.get(CATEGORY, []):
        raw = fetch_feed(url, CATEGORY, limit=CRAWL_FETCH_WINDOW)
        existing = get_existing_links([a.link for a in raw])
        articles.extend(take_first_new(raw, existing, CRAWL_LIMIT_PER_FEED))
    articles.sort(key=_sort_key, reverse=True)
    return articles[:CRAWL_LIMIT_PER_FEED]
