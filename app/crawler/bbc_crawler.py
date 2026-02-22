"""BBC RSS crawler: Tin thế giới, Kinh tế, Công nghệ."""
from typing import List

from app.config import RSS_FEEDS_BY_CATEGORY, CRAWL_LIMIT_PER_FEED, CRAWL_FETCH_WINDOW
from app.models import Article
from app.database import get_existing_links
from .base_rss import fetch_feed, take_first_new

BBC_CATEGORIES = [
    "Tin thế giới",
    "Kinh tế",
    "Công nghệ",
    "Khoa học & Môi trường",
    "Sức khỏe",
    "Thể thao",
]


def crawl_bbc() -> List[Article]:
    """Crawl all BBC feeds and return combined articles. Per feed: fetch window, then take first N not in DB."""
    articles: List[Article] = []
    for category in BBC_CATEGORIES:
        urls = RSS_FEEDS_BY_CATEGORY.get(category, [])
        for url in urls:
            if "bbci.co.uk" in url or "bbc." in url:
                raw = fetch_feed(url, category, limit=CRAWL_FETCH_WINDOW)
                existing = get_existing_links([a.link for a in raw])
                articles.extend(take_first_new(raw, existing, CRAWL_LIMIT_PER_FEED))
    return articles
