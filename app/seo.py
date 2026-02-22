"""
SEO utilities for all pages. Provides professional meta titles, descriptions,
keywords, and Open Graph data for consistent, crawl-friendly content.
"""
import re
from typing import Optional, Any, List
from dataclasses import dataclass

try:
    from app.config.settings import RSS_FEEDS_BY_CATEGORY
except ImportError:
    RSS_FEEDS_BY_CATEGORY = {}

# Site branding (can be overridden via env if needed)
SITE_NAME = "News AI"
SITE_TAGLINE = "Tin tức thông minh - Tổng hợp & dịch bằng AI"
DEFAULT_OG_IMAGE = "/static/img/og-default.png"  # optional fallback
META_DESC_MAX_LEN = 160
KEYWORDS_HOME = "tin tức, news, AI, dịch tin tức, tổng hợp tin, tin thế giới, kinh tế, công nghệ, crypto"

# All category names for "all categories" SEO (from config)
def _all_category_names() -> List[str]:
    return list(RSS_FEEDS_BY_CATEGORY.keys()) if RSS_FEEDS_BY_CATEGORY else []


def _keywords_all_categories() -> str:
    cats = _all_category_names()
    if not cats:
        return KEYWORDS_HOME
    return ", ".join(cats) + ", " + KEYWORDS_HOME


@dataclass
class SEOData:
    """SEO data for a page: title, description, keywords, image, canonical, etc."""
    title: str
    description: str
    keywords: str
    image: Optional[str] = None
    canonical_url: Optional[str] = None
    og_type: str = "website"
    article_published_time: Optional[str] = None
    article_author: Optional[str] = None
    article_section: Optional[str] = None


def _truncate(text: str, max_len: int = META_DESC_MAX_LEN) -> str:
    """Truncate and clean text for meta description."""
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rsplit(" ", 1)[0] + "..."


def _strip_html(text: str) -> str:
    """Remove HTML tags for plain-text meta."""
    if not text:
        return ""
    return re.sub(r"<[^>]+>", " ", text).strip()


def get_seo_for_page(
    page_type: str,
    *,
    title: Optional[str] = None,
    description: Optional[str] = None,
    image: Optional[str] = None,
    canonical_url: Optional[str] = None,
    category: Optional[str] = None,
    source: Optional[str] = None,
    published_iso: Optional[str] = None,
    article_id: Optional[str] = None,
    search_query: Optional[str] = None,
    page_number: Optional[int] = None,
    base_url: str = "",
    **kwargs: Any,
) -> SEOData:
    """
    Get professional SEO data for any page type. Use for all pages (home, article, category, search, etc.).

    Args:
        page_type: One of "home", "article", "category", "search", "not_found".
        title: Page or article title (used for article/detail pages).
        description: Raw description (will be truncated for meta).
        image: Absolute or relative image URL for og:image.
        canonical_url: Full canonical URL for the page.
        category: Category name (e.g. for category/list page or article section).
        source: Source name (e.g. for article author/source).
        published_iso: ISO 8601 date for article (og:article:published_time).
        article_id: Article ID (for canonical or future use).
        search_query: Search query (for search results page).
        page_number: Current page number (for paginated list).
        base_url: Base URL of the site (e.g. https://yoursite.com) for absolute canonical/image.

    Returns:
        SEOData with title, description, keywords, image, canonical_url, og_type, etc.
    """
    base = base_url.rstrip("/") if base_url else ""
    if image and not image.startswith(("http://", "https://", "//")):
        image = (base + image) if base else image

    if page_type == "home":
        seo_title = f"{SITE_NAME} - {SITE_TAGLINE}"
        seo_desc = (
            "Nền tảng tổng hợp tin tức đa nguồn với dịch tự động sang tiếng Việt. "
            "Cập nhật tin thế giới, kinh tế, công nghệ và crypto từ các nguồn uy tín."
        )
        keywords = KEYWORDS_HOME
        return SEOData(
            title=seo_title,
            description=seo_desc,
            keywords=keywords,
            image=image or (base + DEFAULT_OG_IMAGE if base else None),
            canonical_url=canonical_url or (base + "/" if base else None),
            og_type="website",
        )

    if page_type == "article":
        display_title = (title or "Bài viết").strip()
        page_title = f"{display_title} | {SITE_NAME}"
        desc = description or ""
        desc = _strip_html(desc)
        seo_desc = _truncate(desc) if desc else _truncate(f"{display_title} - Đọc bài viết trên {SITE_NAME}.")
        keywords = KEYWORDS_HOME
        if category:
            keywords = f"{category}, {keywords}"
        return SEOData(
            title=page_title,
            description=seo_desc,
            keywords=keywords,
            image=image,
            canonical_url=canonical_url,
            og_type="article",
            article_published_time=published_iso,
            article_author=source,
            article_section=category,
        )

    if page_type == "category":
        cat_name = (category or "").strip()
        if not cat_name:
            # All categories view
            seo_title = f"Tất cả chuyên mục | {SITE_NAME}"
            seo_desc = (
                f"Xem tin tức tất cả chuyên mục: thế giới, kinh tế, công nghệ, khoa học, sức khỏe, thể thao, crypto, AI. "
                f"Tổng hợp và dịch sang tiếng Việt bởi {SITE_NAME}."
            )
            keywords = _keywords_all_categories()
        else:
            seo_title = f"{cat_name} | {SITE_NAME}"
            seo_desc = f"Tin tức mới nhất về {cat_name}. Tổng hợp và dịch sang tiếng Việt bởi {SITE_NAME}."
            keywords = f"{cat_name}, tin tức, {KEYWORDS_HOME}"
        return SEOData(
            title=seo_title,
            description=_truncate(seo_desc) if not cat_name else seo_desc,
            keywords=keywords,
            image=image or (base + DEFAULT_OG_IMAGE if base else None),
            canonical_url=canonical_url,
            og_type="website",
        )

    if page_type == "search":
        query = (search_query or "").strip() or "Tìm kiếm"
        seo_title = f"Tìm kiếm: {query} | {SITE_NAME}"
        seo_desc = f"Kết quả tìm kiếm tin tức cho \"{query}\" trên {SITE_NAME}. Tổng hợp tin đa nguồn, dịch sang tiếng Việt."
        keywords = f"tìm kiếm, {query}, {KEYWORDS_HOME}"
        return SEOData(
            title=seo_title,
            description=_truncate(seo_desc),
            keywords=keywords,
            image=image or (base + DEFAULT_OG_IMAGE if base else None),
            canonical_url=canonical_url,
            og_type="website",
        )

    if page_type == "not_found":
        seo_title = f"Không tìm thấy trang | {SITE_NAME}"
        seo_desc = f"Trang bạn tìm kiếm không tồn tại. Quay lại {SITE_NAME} để xem tin tức mới nhất."
        return SEOData(
            title=seo_title,
            description=seo_desc,
            keywords=KEYWORDS_HOME,
            image=image or (base + DEFAULT_OG_IMAGE if base else None),
            canonical_url=canonical_url,
            og_type="website",
        )

    # Generic fallback
    seo_title = title or SITE_NAME
    if seo_title != SITE_NAME and not seo_title.endswith(SITE_NAME):
        seo_title = f"{seo_title} | {SITE_NAME}"
    seo_desc = _truncate(description or SITE_TAGLINE)
    return SEOData(
        title=seo_title,
        description=seo_desc,
        keywords=KEYWORDS_HOME,
        image=image,
        canonical_url=canonical_url,
        og_type=kwargs.get("og_type", "website"),
    )


def seo_to_dict(seo: SEOData) -> dict:
    """Convert SEOData to a flat dict for API/JSON."""
    d = {
        "title": seo.title,
        "description": seo.description,
        "keywords": seo.keywords,
        "image": seo.image,
        "canonical_url": seo.canonical_url,
        "og_type": seo.og_type,
    }
    if seo.article_published_time:
        d["article_published_time"] = seo.article_published_time
    if seo.article_author:
        d["article_author"] = seo.article_author
    if seo.article_section:
        d["article_section"] = seo.article_section
    return d
