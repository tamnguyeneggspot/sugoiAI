"""MongoDB connection and article persistence."""
from typing import List, Set

import certifi
from pymongo import MongoClient, ASCENDING
from pymongo.database import Database
from pymongo.collection import Collection

from app.config import MONGO_URI, DB_NAME, ARTICLES_COLLECTION
from app.models import Article, article_to_doc

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        # Use certifi CA bundle so SSL/TLS works on Render and other cloud runtimes
        _client = MongoClient(
            MONGO_URI,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=20000,
        )
    return _client


def get_db() -> Database:
    return get_client()[DB_NAME]


def get_articles_collection() -> Collection:
    col = get_db()[ARTICLES_COLLECTION]
    # index for dedup / fast lookup by link
    col.create_index([("link", ASCENDING)], unique=True)
    return col


def get_existing_links(links: List[str]) -> Set[str]:
    """Return set of links that already exist in the articles collection."""
    if not links:
        return set()
    col = get_articles_collection()
    return set(
        doc["link"]
        for doc in col.find({"link": {"$in": links}}, {"link": 1})
    )


def save_article(article: Article) -> bool:
    """Insert one article. Skip if link already exists (upsert by link)."""
    col = get_articles_collection()
    doc = article_to_doc(article)
    try:
        col.replace_one({"link": doc["link"]}, doc, upsert=True)
        return True
    except Exception:
        return False


def save_articles(articles: List[Article]) -> int:
    """Save only articles chưa có trong DB (theo link). Không tạo duplicate, không ghi đè tin cũ."""
    if not articles:
        return 0
    col = get_articles_collection()
    links = [a.link for a in articles]
    existing = set(
        doc["link"]
        for doc in col.find({"link": {"$in": links}}, {"link": 1})
    )
    saved = 0
    for a in articles:
        if a.link in existing:
            continue
        doc = article_to_doc(a)
        try:
            col.insert_one(doc)
            existing.add(a.link)
            saved += 1
        except Exception:
            pass
    return saved
