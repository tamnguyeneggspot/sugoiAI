"""Run all crawlers and save to MongoDB."""
from typing import List
from datetime import datetime

from app.config import EXTRACT_CONTENT
from app.crawler import crawl_bbc, crawl_reuters, crawl_crypto, crawl_nyt, crawl_robotics, crawl_ai
from app.models import Article
from app.database import save_articles, get_articles_collection
from app.extractor import extract_content, extract_hero_image
from app.ai import translate_article_content
from app.ai.translate_service import translate_title_and_summary


def run_all_crawlers() -> int:
    """Run BBC, Reuters, Crypto, Robotics, AI (and NYT if configured). Save to DB. Return total saved count."""
    articles: List[Article] = []
    articles.extend(crawl_bbc())
    articles.extend(crawl_reuters())
    articles.extend(crawl_crypto())
    articles.extend(crawl_nyt())
    articles.extend(crawl_robotics())
    articles.extend(crawl_ai())

    if EXTRACT_CONTENT:
        for article in articles:
            if not article.content:
                article.content = extract_content(article.link)

    return save_articles(articles)


def run_translation(limit: int = 0) -> int:
    """
    Translate articles that have content but no content_VN.
    Runs sequentially (single-threaded).
    
    Args:
        limit: Max number of articles to translate. 0 = no limit.
    
    Returns:
        Number of articles translated.
    """
    col = get_articles_collection()
    
    query = {
        "content": {"$ne": None, "$exists": True},
        "$or": [
            {"content_VN": None},
            {"content_VN": {"$exists": False}}
        ]
    }
    
    cursor = col.find(query)
    if limit > 0:
        cursor = cursor.limit(limit)
    
    articles_to_translate = list(cursor)
    total = len(articles_to_translate)
    
    if total == 0:
        print("No articles need translation.")
        return 0
    
    print(f"Found {total} articles to translate.")
    translated_count = 0
    
    for i, doc in enumerate(articles_to_translate):
        #print(f"Translating article {i+1}/{total}...")
        content = doc.get("content", "")
        full_title = doc.get("title", "")
        #print(f"Full title: {full_title}")
        content_vn = translate_article_content_raw(content, full_title)
        doc_id = doc["_id"]
        title = full_title[:50]
        #print(f"Translated article {i+1}/{total}...")
        timestamp = datetime.now().strftime("%H:%M:%S")
        if content_vn:
            col.update_one(
                {"_id": doc_id},
                {"$set": {"content_VN": content_vn}}
            )
            translated_count += 1
            print(f"[{i+1}/{total}] [{timestamp}] ✓ {title}...")
        else:
            print(f"[{i+1}/{total}] [{timestamp}] ✗ {title}...")
    
    print(f"\nCompleted: {translated_count}/{total} articles translated.")
    return translated_count


def translate_article_content_raw(content: str, title: str) -> str:
    """Wrapper to call translate service with raw content and title."""
    from app.ai.translate_service import translate_and_format
    return translate_and_format(content, title)


def update_article_title_summary_vn(article_id) -> bool:
    """
    Translate title and summary for one article and update title_vn and summary_vn in the DB.
    article_id: MongoDB _id (ObjectId or str).
    Returns True if the document was updated, False if not found or translation failed.
    """
    from bson import ObjectId

    col = get_articles_collection()
    oid = ObjectId(article_id) if isinstance(article_id, str) else article_id
    doc = col.find_one({"_id": oid})
    if not doc:
        return False

    title = doc.get("title", "")
    summary = doc.get("summary") or ""
    title_vn, summary_vn = translate_title_and_summary(title, summary or None)

    updates = {}
    if title_vn is not None:
        updates["title_vn"] = title_vn
    if summary_vn is not None:
        updates["summary_vn"] = summary_vn
    if not updates:
        return False

    col.update_one({"_id": oid}, {"$set": updates})
    return True


def run_translate_title_summary(limit: int = 0) -> int:
    """
    Translate title and summary to Vietnamese for articles that don't have title_vn or summary_vn.
    Saves results to title_vn and summary_vn.
    """
    col = get_articles_collection()

    query = {
        "$or": [
            {"title_vn": None},
            {"title_vn": {"$exists": False}},
            {"summary_vn": None},
            {"summary_vn": {"$exists": False}},
        ]
    }

    cursor = col.find(query)
    if limit > 0:
        cursor = cursor.limit(limit)

    articles_to_translate = list(cursor)
    total = len(articles_to_translate)

    if total == 0:
        print("No articles need title/summary translation.")
        return 0

    print(f"Found {total} articles to translate title/summary.")
    translated_count = 0

    for i, doc in enumerate(articles_to_translate):
        title = doc.get("title", "")
        summary = doc.get("summary") or ""
        doc_id = doc["_id"]

        title_vn, summary_vn = translate_title_and_summary(title, summary or None)

        updates = {}
        if title_vn is not None:
            updates["title_vn"] = title_vn
        if summary_vn is not None:
            updates["summary_vn"] = summary_vn

        timestamp = datetime.now().strftime("%H:%M:%S")
        if updates:
            col.update_one({"_id": doc_id}, {"$set": updates})
            translated_count += 1
            print(f"[{i+1}/{total}] [{timestamp}] ✓ {title[:50]}...")
        else:
            print(f"[{i+1}/{total}] [{timestamp}] ✗ {title[:50]}...")

    print(f"\nCompleted: {translated_count}/{total} title/summary translations.")
    return translated_count


def run_extract_hero_images(limit: int = 0, size: int = 800) -> int:
    """
    Extract hero images for articles that don't have content_top_image.
    Runs sequentially (single-threaded).
    
    Args:
        limit: Max number of articles to process. 0 = no limit.
        size: Image size for BBC images (default: 800).
    
    Returns:
        Number of articles updated with hero images.
    """
    col = get_articles_collection()
    
    query = {
        "$or": [
            {"content_top_image": None},
            {"content_top_image": {"$exists": False}}
        ]
    }
    
    cursor = col.find(query)
    if limit > 0:
        cursor = cursor.limit(limit)
    
    articles_to_process = list(cursor)
    total = len(articles_to_process)
    
    if total == 0:
        print("No articles need hero image extraction.")
        return 0
    
    print(f"Found {total} articles to extract hero images.")
    updated_count = 0
    
    for i, doc in enumerate(articles_to_process):
        link = doc.get("link", "")
        title = doc.get("title", "")[:50]
        hero_img = extract_hero_image(link, size=size)
        doc_id = doc["_id"]
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        if hero_img:
            col.update_one(
                {"_id": doc_id},
                {"$set": {"content_top_image": hero_img}}
            )
            updated_count += 1
            print(f"[{i+1}/{total}] [{timestamp}] ✓ {title}...")
        else:
            print(f"[{i+1}/{total}] [{timestamp}] ✗ {title}...")
    
    print(f"\nCompleted: {updated_count}/{total} articles updated with hero images.")
    return updated_count


def _all_vn_fields_set(doc: dict) -> bool:
    """Return True if title_vn, summary_vn, content_VN are all non-null and non-empty."""
    title_vn = doc.get("title_vn")
    summary_vn = doc.get("summary_vn")
    content_vn = doc.get("content_VN")
    return (
        title_vn is not None
        and title_vn != ""
        and summary_vn is not None
        and summary_vn != ""
        and content_vn is not None
        and content_vn != ""
    )


def set_is_show_for_article(article_id) -> bool:
    """
    If title_vn, summary_vn, content_VN are all non-null and non-empty, set isShow = True.
    article_id: MongoDB _id (ObjectId or str).
    Returns True if isShow was set to True, False otherwise.
    """
    from bson import ObjectId

    col = get_articles_collection()
    oid = ObjectId(article_id) if isinstance(article_id, str) else article_id
    doc = col.find_one({"_id": oid})
    if not doc or not _all_vn_fields_set(doc):
        return False
    col.update_one({"_id": oid}, {"$set": {"isShow": True}})
    return True


def run_update_is_show(limit: int = 0) -> int:
    """
    For all articles where title_vn, summary_vn, content_VN are all non-null and non-empty,
    set isShow = True. Returns number of documents updated.
    """
    col = get_articles_collection()
    query = {
        "title_vn": {"$exists": True, "$nin": [None, ""]},
        "summary_vn": {"$exists": True, "$nin": [None, ""]},
        "content_VN": {"$exists": True, "$nin": [None, ""]},
    }
    cursor = col.find(query)
    if limit > 0:
        cursor = cursor.limit(limit)
    docs = list(cursor)
    updated = 0
    for doc in docs:
        if not _all_vn_fields_set(doc):
            continue
        r = col.update_one(
            {"_id": doc["_id"]},
            {"$set": {"isShow": True}},
        )
        if r.modified_count:
            updated += 1
    return updated
