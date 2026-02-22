"""Article model for MongoDB."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class Article(BaseModel):
    """Article document stored in MongoDB."""

    title: str
    link: str
    summary: Optional[str] = None
    category: str
    source_feed: str  # RSS URL or source name
    source: Optional[str] = None  # short name: bbc, coindesk, cointelegraph, reuters, nyt, etc.
    thumbnail: Optional[str] = None  # image URL from media:thumbnail or similar
    content_top_image: Optional[str] = None  # hero image extracted from article page
    published: Optional[datetime] = None
    crawled_at: datetime = Field(default_factory=datetime.utcnow)
    content: Optional[str] = None  # full text if extracted
    content_VN: Optional[str] = None  # translated & formatted Vietnamese content
    title_vn: Optional[str] = None  # translated Vietnamese title
    summary_vn: Optional[str] = None  # translated Vietnamese summary
    isShow: Optional[bool] = None  # true when title_vn, summary_vn, content_VN are all set

    class Config:
        from_attributes = True


def article_to_doc(article: Article) -> dict:
    """Convert Article to MongoDB document (with datetime)."""
    d = article.model_dump()
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v
    return d


def doc_to_article(doc: dict) -> Article:
    """Build Article from MongoDB document."""
    doc = {k: v for k, v in doc.items() if k != "_id"}
    if doc.get("crawled_at") and isinstance(doc["crawled_at"], str):
        doc = {**doc, "crawled_at": datetime.fromisoformat(doc["crawled_at"].replace("Z", "+00:00"))}
    if doc.get("published") and isinstance(doc["published"], str):
        doc = {**doc, "published": datetime.fromisoformat(doc["published"].replace("Z", "+00:00"))}
    return Article(**doc)
