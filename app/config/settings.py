"""App settings: RSS feeds by category and MongoDB."""
import os
from pathlib import Path

# Load .env from project root (news/ or news-ai-system/)
_env_path = Path(__file__).resolve().parents[2]
_env_file = _env_path / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)

# MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "news_db")
ARTICLES_COLLECTION = "articles"

# RSS feeds by category (Category name -> list of feed URLs)
RSS_FEEDS_BY_CATEGORY = {
    "Tin thế giới": [
        "http://feeds.bbci.co.uk/news/world/rss.xml",
    ],
    "Kinh tế": [
        "http://feeds.bbci.co.uk/news/business/rss.xml",
    ],
    "Công nghệ": [
        "http://feeds.bbci.co.uk/news/technology/rss.xml",
    ],
    "Khoa học & Môi trường": [
        "http://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    ],
    "Sức khỏe": [
        "http://feeds.bbci.co.uk/news/health/rss.xml",
    ],
    "Thể thao": [
        "http://feeds.bbci.co.uk/sport/rss.xml",
    ],
    "Crypto": [
        "https://www.coindesk.com/arc/outboundfeeds/rss/",
        "https://cointelegraph.com/rss",
    ],
    "Robotics": [
        "https://newatlas.com/robotics/index.rss",
    ],
    "AI": [
        "https://www.artificialintelligence-news.com/feed/",
        "https://www.zdnet.com/topic/artificial-intelligence/rss.xml",
    ],
    # "Reuters World": [
    #     "https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en",
    # ],
}

# Optional: request timeout (seconds)
FETCH_TIMEOUT = int(os.getenv("FETCH_TIMEOUT", "30"))

# Số tin tối đa lấy mới nhất cho mỗi category/feed (tránh crawl quá nhiều)
CRAWL_LIMIT_PER_FEED = int(os.getenv("CRAWL_LIMIT_PER_FEED", "10"))

# Số entry tối đa lấy từ mỗi feed để tìm đủ CRAWL_LIMIT_PER_FEED bài chưa có trong DB (nếu top N đã insert thì lấy N tiếp theo)
CRAWL_FETCH_WINDOW = int(os.getenv("CRAWL_FETCH_WINDOW", "60"))

# If True, fetch full article HTML and extract text into content (slower, one request per article) and extract text into content (slower, one request per article)
EXTRACT_CONTENT = os.getenv("EXTRACT_CONTENT", "true").lower() in ("1", "true", "yes")

# Ollama settings for translation
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.5:cloud")
ENABLE_TRANSLATION = os.getenv("ENABLE_TRANSLATION", "true").lower() in ("1", "true", "yes")

# API security: rate limit (e.g. "100/minute", "1000/hour")
RATE_LIMIT_DEFAULT = os.getenv("RATE_LIMIT_DEFAULT", "100/minute")
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() in ("1", "true", "yes")
