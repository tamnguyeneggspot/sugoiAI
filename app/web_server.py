"""FastAPI web server for news frontend."""
import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
from datetime import datetime
from urllib.parse import quote

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api import router as api_router
from app.limiter import limiter
from app.database.mongo import get_articles_collection
from app.config.settings import RSS_FEEDS_BY_CATEGORY

app = FastAPI(
    title="Sugoi News - Học tiếng Nhật qua tin tức",
    description="AI-powered news aggregator with Vietnamese translation",
    version="1.0.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers (run for every response)
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


# Cache static assets (CSS, JS, images) for 1 week (SEO 2.2 Performance)
class StaticCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/static/"):
            response.headers.setdefault(
                "Cache-Control", "public, max-age=604800"
            )  # 7 days
        return response


app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(StaticCacheMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the main frontend page."""
    html_file = STATIC_DIR / "index.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>Frontend not found</h1>")


@app.get("/article/{article_id}", response_class=HTMLResponse)
async def article_page_by_id(request: Request, article_id: str):
    """Serve the article detail page for friendly URL /article/{id}."""
    html_file = STATIC_DIR / "article.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>Article page not found</h1>")


@app.get("/article", response_class=HTMLResponse)
async def article_page(request: Request):
    """Serve the article detail page (standalone, no id)."""
    html_file = STATIC_DIR / "article.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>Article page not found</h1>")


@app.get("/about.html", response_class=HTMLResponse)
async def about_page(request: Request):
    """Serve the about page."""
    html_file = STATIC_DIR / "about.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>About page not found</h1>")


@app.get("/guide.html", response_class=HTMLResponse)
async def guide_page(request: Request):
    """Serve the guide page."""
    html_file = STATIC_DIR / "guide.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>Guide page not found</h1>")


@app.get("/faq.html", response_class=HTMLResponse)
async def faq_page(request: Request):
    """Serve the FAQ page."""
    html_file = STATIC_DIR / "faq.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text(encoding="utf-8"))
    return HTMLResponse(content="<h1>FAQ page not found</h1>")


@app.get("/googlea64e30f7786323f3.html", response_class=HTMLResponse, include_in_schema=False)
async def google_verification():
    """Serve Google Search Console verification file at root (required by Google)."""
    path = STATIC_DIR / "googlea64e30f7786323f3.html"
    if path.exists():
        return HTMLResponse(content=path.read_text(encoding="utf-8"))
    return HTMLResponse(content="not found", status_code=404)


@app.get("/health")
@limiter.exempt
async def health_check(request: Request):
    """Health check endpoint (exempt from rate limit)."""
    return {"status": "ok"}


@app.get("/sitemap.xml")
@limiter.exempt
async def sitemap(request: Request):
    """Generate dynamic sitemap.xml from MongoDB articles."""
    base_url = str(request.base_url).rstrip("/")
    
    # Start building XML
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    
    # Homepage
    xml_parts.append('  <url>')
    xml_parts.append(f'    <loc>{base_url}/</loc>')
    xml_parts.append(f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>')
    xml_parts.append('    <changefreq>daily</changefreq>')
    xml_parts.append('    <priority>1.0</priority>')
    xml_parts.append('  </url>')
    
    # Category pages
    for category in RSS_FEEDS_BY_CATEGORY.keys():
        category_url = f"{base_url}/?category={quote(category)}"
        xml_parts.append('  <url>')
        xml_parts.append(f'    <loc>{category_url}</loc>')
        xml_parts.append(f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>')
        xml_parts.append('    <changefreq>daily</changefreq>')
        xml_parts.append('    <priority>0.8</priority>')
        xml_parts.append('  </url>')
    
    # Additional pages
    additional_pages = [
        ("about.html", 0.7, "monthly"),
        ("guide.html", 0.7, "monthly"),
        ("faq.html", 0.7, "monthly"),
    ]
    for page_path, priority, changefreq in additional_pages:
        page_url = f"{base_url}/{page_path}"
        xml_parts.append('  <url>')
        xml_parts.append(f'    <loc>{page_url}</loc>')
        xml_parts.append(f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>')
        xml_parts.append(f'    <changefreq>{changefreq}</changefreq>')
        xml_parts.append(f'    <priority>{priority}</priority>')
        xml_parts.append('  </url>')
    
    # All articles from MongoDB
    col = get_articles_collection()
    articles = col.find(
        {"isShow": True},
        {"_id": 1, "published": 1}
    ).sort("published", -1)
    
    for doc in articles:
        article_id = str(doc["_id"])
        article_url = f"{base_url}/article/{quote(article_id)}"
        published = doc.get("published")
        
        xml_parts.append('  <url>')
        xml_parts.append(f'    <loc>{article_url}</loc>')
        if published:
            lastmod = published.strftime("%Y-%m-%d") if isinstance(published, datetime) else datetime.now().strftime("%Y-%m-%d")
        else:
            lastmod = datetime.now().strftime("%Y-%m-%d")
        xml_parts.append(f'    <lastmod>{lastmod}</lastmod>')
        xml_parts.append('    <changefreq>weekly</changefreq>')
        xml_parts.append('    <priority>0.7</priority>')
        xml_parts.append('  </url>')
    
    xml_parts.append('</urlset>')
    
    return Response(
        content="\n".join(xml_parts),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"}  # Cache 1 hour
    )


@app.get("/robots.txt")
@limiter.exempt
async def robots_txt(request: Request):
    """Generate robots.txt: allow crawlers, disallow API/health, point to sitemap."""
    base_url = str(request.base_url).rstrip("/")
    content = f"""User-agent: *
Allow: /
Disallow: /api/
Disallow: /health

Sitemap: {base_url}/sitemap.xml
"""
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Cache-Control": "public, max-age=86400"}  # Cache 24 hours
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.web_server:app", host="0.0.0.0", port=8000, reload=True)
