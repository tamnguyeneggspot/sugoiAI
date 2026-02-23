"""NHK RSS crawler: tin tức tiếng Nhật (tất cả category từ config)."""
from datetime import datetime
from typing import List

from app.config import RSS_FEEDS_BY_CATEGORY, CRAWL_LIMIT_PER_FEED, CRAWL_FETCH_WINDOW
from app.models import Article
from app.database import get_existing_links
from .base_rss import fetch_feed, take_first_new


def _sort_key(a: Article) -> datetime:
    """Sort by published date, newest first; no date goes last."""
    return a.published or datetime.min


def crawl_nhk() -> List[Article]:
    """Crawl tất cả feed NHK theo RSS_FEEDS_BY_CATEGORY; mỗi feed lấy N bài mới chưa có trong DB."""
    articles: List[Article] = []
    for category, urls in RSS_FEEDS_BY_CATEGORY.items():
        for url in urls:
            raw = fetch_feed(url, category, limit=CRAWL_FETCH_WINDOW)
            existing = get_existing_links([a.link for a in raw])
            articles.extend(take_first_new(raw, existing, CRAWL_LIMIT_PER_FEED))
    articles.sort(key=_sort_key, reverse=True)
    return articles
