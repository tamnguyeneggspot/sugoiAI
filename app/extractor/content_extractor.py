"""Extract full article content from URL (optional step after RSS)."""
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup
from trafilatura import extract

from app.config import FETCH_TIMEOUT

# Minimum chars from trafilatura to consider it "main content" (avoid nav-only)
_MIN_MAIN_CONTENT = 200


def _fetch_html(url: str) -> Optional[str]:
    """Fetch page HTML with our timeout and user-agent."""
    try:
        r = requests.get(
            url,
            timeout=FETCH_TIMEOUT,
            headers={"User-Agent": "NewsCrawler/1.0"},
        )
        r.raise_for_status()
        return r.text
    except Exception:
        return None


def _fallback_full_page_text(html: str) -> Optional[str]:
    """Get all page text (includes nav/footer). Used when trafilatura finds no article."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    text = re.sub(r"\n\s*\n", "\n\n", text).strip()
    return text[:50000] if text else None


def extract_content(url: str) -> Optional[str]:
    """
    Fetch URL and extract main article text only (not nav, footer, related links).
    Uses trafilatura for main-content extraction; falls back to full-page text if needed.
    Returns None on failure or if no meaningful text.
    """
    html = _fetch_html(url)
    if not html:
        return None

    # Extract only main article body (strips headers, footers, nav, related blocks)
    main_text = extract(
        html,
        url=url,
        include_comments=False,
        include_tables=True,
        no_fallback=False,
    )
    if main_text and len(main_text.strip()) >= _MIN_MAIN_CONTENT:
        normalized = re.sub(r"\n\s*\n", "\n\n", main_text.strip())
        return normalized[:50000]
    # Fallback if trafilatura didn't find a clear article (e.g. some SPA/JSON pages)
    return _fallback_full_page_text(html)


def extract_hero_image(url: str, size: int = 800) -> Optional[str]:
    """
    Extract hero image from BBC article URL.
    Prioritizes cpsprodpb images from hero-image element over branded_news og:image.
    Available sizes: 240, 320, 480, 640, 800, 1024, 1536
    """
    html = _fetch_html(url)
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    # Priority 1: Look for hero-image element with cpsprodpb URL (better quality)
    hero_div = soup.find(attrs={"data-testid": "hero-image"})
    if hero_div:
        img = hero_div.find("img")
        if img:
            # Try srcset first (contains multiple sizes)
            srcset = img.get("srcset", "")
            if srcset and "cpsprodpb" in srcset:
                # Extract any cpsprodpb URL from srcset and resize
                match = re.search(r"(https://ichef\.bbci\.co\.uk/news/\d+/cpsprodpb/[^\s]+)", srcset)
                if match:
                    img_url = match.group(1)
                    return re.sub(r"/news/\d+/", f"/news/{size}/", img_url)
            # Try src attribute
            src = img.get("src", "")
            if src and "cpsprodpb" in src:
                return re.sub(r"/news/\d+/", f"/news/{size}/", src)

    # Priority 2: Look for any img with cpsprodpb URL in article
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if "ichef.bbci.co.uk/news/" in src and "cpsprodpb" in src:
            return re.sub(r"/news/\d+/", f"/news/{size}/", src)

    # Fallback: og:image meta tag (may have branded_news URL)
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        img_url = og_image["content"]
        if "ichef.bbci.co.uk/news/" in img_url:
            return re.sub(r"/news/\d+/", f"/news/{size}/", img_url)
        return img_url
    return None
