"""API endpoints for news articles."""
from typing import Optional, List
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
from datetime import datetime

from app.database.mongo import get_articles_collection
from app.seo import get_seo_for_page, seo_to_dict

router = APIRouter(prefix="/api", tags=["articles"])


class ArticleResponse(BaseModel):
    """Article response model."""
    id: str
    title: str
    link: str
    summary: Optional[str] = None
    title_vn: Optional[str] = None
    summary_vn: Optional[str] = None
    category: str
    source_feed: str
    source: Optional[str] = None
    thumbnail: Optional[str] = None
    content_top_image: Optional[str] = None
    published: Optional[datetime] = None
    crawled_at: datetime
    content: Optional[str] = None
    content_VN: Optional[str] = None


class ArticlesListResponse(BaseModel):
    """Paginated articles response."""
    articles: List[ArticleResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class CategoryCount(BaseModel):
    """Category with article count."""
    name: str
    count: int


class SourceCount(BaseModel):
    """Source with article count."""
    name: str
    count: int


@router.get("/articles", response_model=ArticlesListResponse)
async def get_articles(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(12, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    source: Optional[str] = Query(None, description="Filter by source"),
    search: Optional[str] = Query(None, description="Search in title/summary"),
    translated_only: bool = Query(False, description="Only show translated articles"),
):
    """Get paginated list of articles with filters."""
    col = get_articles_collection()
    
    query = {"isShow": True}
    
    if category:
        query["category"] = category
    
    if source:
        query["source"] = source
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"title_vn": {"$regex": search, "$options": "i"}},
            {"summary": {"$regex": search, "$options": "i"}},
            {"summary_vn": {"$regex": search, "$options": "i"}},
        ]
    
    if translated_only:
        query["content_VN"] = {"$ne": None, "$exists": True}
    
    total = col.count_documents(query)
    total_pages = (total + page_size - 1) // page_size
    
    skip = (page - 1) * page_size
    
    cursor = col.find(query).sort("published", -1).skip(skip).limit(page_size)
    
    articles = []
    for doc in cursor:
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        articles.append(ArticleResponse(**doc))
    
    return ArticlesListResponse(
        articles=articles,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/featured", response_model=List[ArticleResponse])
async def get_featured_articles(limit: int = Query(3, ge=1, le=5, description="Number of featured articles")):
    """Get 1–3 featured articles for homepage: 3 bài mới nhất (isShow=True)."""
    col = get_articles_collection()
    query = {"isShow": True}
    cursor = col.find(query).sort("published", -1).limit(limit)
    articles = []
    for doc in cursor:
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        articles.append(ArticleResponse(**doc))
    return articles


@router.get("/articles/{article_id}")
async def get_article_by_id(article_id: str):
    """Get single article by MongoDB _id."""
    from bson.objectid import ObjectId
    from bson.errors import InvalidId
    col = get_articles_collection()
    try:
        oid = ObjectId(article_id)
    except InvalidId:
        return {"error": "Article not found"}
    doc = col.find_one({"_id": oid, "isShow": True})
    if doc:
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
        return ArticleResponse(**doc)
    return {"error": "Article not found"}


@router.get("/categories", response_model=List[CategoryCount])
async def get_categories():
    """Get all categories with article counts (only isShow=True)."""
    col = get_articles_collection()
    pipeline = [
        {"$match": {"isShow": True}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    result = list(col.aggregate(pipeline))
    return [CategoryCount(name=r["_id"], count=r["count"]) for r in result if r["_id"]]


@router.get("/sources", response_model=List[SourceCount])
async def get_sources():
    """Get all sources with article counts (only isShow=True)."""
    col = get_articles_collection()
    pipeline = [
        {"$match": {"isShow": True, "source": {"$ne": None}}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    result = list(col.aggregate(pipeline))
    return [SourceCount(name=r["_id"], count=r["count"]) for r in result if r["_id"]]


@router.get("/stats")
async def get_stats():
    """Get general statistics (only isShow=True)."""
    col = get_articles_collection()
    show_query = {"isShow": True}
    total = col.count_documents(show_query)
    translated = col.count_documents({**show_query, "content_VN": {"$ne": None, "$exists": True}})
    
    categories = col.distinct("category", show_query)
    sources = col.distinct("source", show_query)
    
    return {
        "total_articles": total,
        "translated_articles": translated,
        "categories_count": len([c for c in categories if c]),
        "sources_count": len([s for s in sources if s]),
    }


# --- SEO (used by all pages) ---

@router.get("/seo")
async def get_seo(
    request: Request,
    page: str = Query("home", description="Page type: home, article, category, search, not_found"),
    article_id: Optional[str] = Query(None, description="Article ID (for page=article)"),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    base_url: Optional[str] = Query(None, description="Base URL for canonical/image (e.g. https://yoursite.com)"),
):
    """Get SEO data for any page. Used by frontend to set meta tags consistently."""
    base = base_url or str(request.base_url).rstrip("/")
    if page == "article" and article_id:
        from bson.objectid import ObjectId
        from bson.errors import InvalidId
        col = get_articles_collection()
        try:
            oid = ObjectId(article_id)
        except InvalidId:
            seo = get_seo_for_page("not_found", base_url=base)
            return seo_to_dict(seo)
        doc = col.find_one({"_id": oid, "isShow": True})
        if doc:
            title = doc.get("title_vn") or doc.get("title")
            desc = (doc.get("summary_vn") or doc.get("summary") or doc.get("content") or doc.get("content_VN") or "")
            img = doc.get("content_top_image") or doc.get("thumbnail")
            published = doc.get("published")
            published_iso = published.isoformat() if published else None
            canonical = f"{base}/article?id={article_id}"
            seo = get_seo_for_page(
                "article",
                title=title,
                description=desc,
                image=img,
                canonical_url=canonical,
                category=doc.get("category"),
                source=doc.get("source"),
                published_iso=published_iso,
                base_url=base,
            )
            return seo_to_dict(seo)
        seo = get_seo_for_page("not_found", base_url=base)
        return seo_to_dict(seo)
    if page == "category":
        seo = get_seo_for_page("category", category=category, canonical_url=f"{base}/?category={category or ''}", base_url=base)
        return seo_to_dict(seo)
    if page == "search":
        seo = get_seo_for_page("search", search_query=search, canonical_url=f"{base}/?search={search or ''}", base_url=base)
        return seo_to_dict(seo)
    if page == "not_found":
        seo = get_seo_for_page("not_found", base_url=base)
        return seo_to_dict(seo)
    seo = get_seo_for_page("home", base_url=base)
    return seo_to_dict(seo)
