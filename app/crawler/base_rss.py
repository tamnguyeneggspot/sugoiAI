"""Base RSS fetching logic."""
import re
import ssl
from datetime import datetime
from typing import List, Optional, Set
from urllib.request import Request, urlopen

import feedparser

from app.config import FETCH_TIMEOUT, CRAWL_LIMIT_PER_FEED
from app.models import Article

# SSL context that does not verify certificates (avoids errors with self-signed or proxy certs)
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE


def strip_html_tags(text: str) -> str:
    """Remove HTML tags and clean up whitespace from text."""
    if not text:
        return text
    clean = re.sub(r'<[^>]+>', '', text)
    clean = re.sub(r'\s+', ' ', clean)
    return clean.strip()


def parse_date(entry) -> Optional[datetime]:
    """Parse published_parsed or updated_parsed from feed entry."""
    for key in ("published_parsed", "updated_parsed"):
        val = getattr(entry, key, None)
        if val and hasattr(val, "tm_year"):
            try:
                return datetime(*val[:6])
            except (TypeError, ValueError):
                pass
    return None


def _thumbnail_from_entry(entry) -> Optional[str]:
    """Extract first media:thumbnail URL from feed entry."""
    thumbnails = getattr(entry, "media_thumbnail", None)
    if thumbnails and len(thumbnails) > 0:
        first = thumbnails[0]
        if isinstance(first, dict) and first.get("url"):
            return first["url"]
        if hasattr(first, "url"):
            return getattr(first, "url", None)
    return None


def normalize_nhk_article_url(url: str) -> str:
    """
    Chuẩn hóa link bài NHK từ RSS (www3.nhk.or.jp/news/html/...) sang URL nội dung thực
    (news.web.nhk/newsweb/na/na-...) vì link RSS không tự redirect.
    """
    if not url or "www3.nhk.or.jp/news/html/" not in url:
        return url
    # Pattern: .../news/html/YYYYMMDD/k100XXXXXX.html -> id = k100XXXXXX
    match = re.search(r"/news/html/\d+/([a-z0-9]+)\.html", url, re.I)
    if not match:
        return url
    article_id = match.group(1)
    return f"https://news.web.nhk/newsweb/na/na-{article_id}"


def _source_from_url(url: str) -> str:
    """Derive short source name from feed URL (e.g. bbc, coindesk)."""
    url_lower = url.lower()
    if "bbci.co.uk" in url_lower or "bbc." in url_lower:
        return "bbc"
    if "coindesk" in url_lower:
        return "coindesk"
    if "cointelegraph" in url_lower:
        return "cointelegraph"
    if "reuters" in url_lower:
        return "reuters"
    if "nytimes" in url_lower or "nyt." in url_lower:
        return "nyt"
    if "newatlas" in url_lower:
        return "newatlas"
    if "artificialintelligence-news" in url_lower:
        return "ai-news"
    if "zdnet" in url_lower:
        return "zdnet"
    if "nhk.or.jp" in url_lower:
        return "nhk"
    if "mainichi.jp" in url_lower:
        return "mainichi"
    if "asahi.com" in url_lower:
        return "asahi"
    if "yahoo.co.jp" in url_lower:
        return "yahoo"
    return "unknown"


def take_first_new(articles: List[Article], existing_links: Set[str], n: int) -> List[Article]:
    """Lấy tối đa n bài đầu tiên (theo thứ tự feed) mà link chưa có trong existing_links."""
    out: List[Article] = []
    for a in articles:
        if len(out) >= n:
            break
        if a.link not in existing_links:
            out.append(a)
    return out


def fetch_feed(url: str, category: str, source: Optional[str] = None, limit: Optional[int] = None) -> List[Article]:
    """Fetch RSS feed and return list of Article for the given category (top N mới nhất)."""
    req = Request(url, headers={"User-Agent": "NewsCrawler/1.0"})
    with urlopen(req, timeout=FETCH_TIMEOUT, context=_SSL_CTX) as resp:
        content = resp.read()
    feed = feedparser.parse(content)
    source_name = source or _source_from_url(url)
    max_entries = limit if limit is not None else CRAWL_LIMIT_PER_FEED
    articles: List[Article] = []
    for entry in feed.entries[:max_entries]:
        link = getattr(entry, "link", "") or ""
        if not link:
            continue
        link = normalize_nhk_article_url(link)
        title = getattr(entry, "title", "") or ""
        summary = getattr(entry, "summary", "") or getattr(entry, "description", "") or None
        if summary and hasattr(summary, "strip"):
            summary = strip_html_tags(summary)[:2000]  # strip HTML and limit length
        published = parse_date(entry)
        thumbnail = _thumbnail_from_entry(entry)
        articles.append(
            Article(
                title=title,
                link=link,
                summary=summary,
                category=category,
                source_feed=url,
                source=source_name,
                thumbnail=thumbnail,
                published=published,
            )
        )
    return articles
