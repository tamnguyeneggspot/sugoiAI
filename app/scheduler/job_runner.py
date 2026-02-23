"""Run all crawlers and save to MongoDB."""
from typing import Callable, List, Optional, Tuple
from datetime import datetime

from app.config import EXTRACT_CONTENT
from app.crawler import crawl_nhk
from app.models import Article
from app.database import save_articles, get_articles_collection
from app.extractor import extract_content, extract_hero_image
from app.ai import translate_article_content
from app.ai.translate_service import translate_title_and_summary, translate_content_from_paragraph_list


def run_all_crawlers() -> int:
    """Run crawler NHK (tất cả category từ config). Save to DB. Return total saved count."""
    articles: List[Article] = list(crawl_nhk())

    if EXTRACT_CONTENT:
        for article in articles:
            if not article.content:
                article.content = extract_content(article.link)

    return save_articles(articles)


def run_translation(limit: int = 0) -> int:
    """
    Translate articles that have content but no content_vn_paragrap_list (or empty).
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
            {"content_vn_paragrap_list": None},
            {"content_vn_paragrap_list": {"$exists": False}},
            {"content_vn_paragrap_list": []},
        ],
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
        doc_id = doc["_id"]
        title = full_title[:50]

        def save_jp_paragraphs(paragrap_list: List[str]) -> None:
            """Lưu content_jp_paragrap_list vào DB ngay sau format+split (trước khi dịch)."""
            col.update_one(
                {"_id": doc_id},
                {"$set": {"content_jp_paragrap_list": paragrap_list}}
            )

        def save_vn_paragraphs(paragrap_list: List[str]) -> None:
            """Lưu content_vn_paragrap_list vào DB sau khi dịch từng đoạn (map 1:1)."""
            col.update_one(
                {"_id": doc_id},
                {"$set": {"content_vn_paragrap_list": paragrap_list}}
            )

        content_jp_paragrap_list, content_vn_paragrap_list = translate_article_content_raw(
            content, full_title,
            on_jp_paragraphs_ready=save_jp_paragraphs,
            on_vn_paragraphs_ready=save_vn_paragraphs,
        )
        timestamp = datetime.now().strftime("%H:%M:%S")
        if content_vn_paragrap_list:
            col.update_one(
                {"_id": doc_id},
                {"$set": {"content_vn_paragrap_list": content_vn_paragrap_list}}
            )
            translated_count += 1
            print(f"[{i+1}/{total}] [{timestamp}] ✓ {title}...")
        else:
            print(f"[{i+1}/{total}] [{timestamp}] ✗ {title}...")
    
    print(f"\nCompleted: {translated_count}/{total} articles translated.")
    return translated_count


def translate_article_content_raw(
    content: str,
    title: str,
    on_jp_paragraphs_ready: Optional[Callable[[List[str]], None]] = None,
    on_vn_paragraphs_ready: Optional[Callable[[List[str]], None]] = None,
) -> Tuple[List[str], List[str]]:
    """
    Wrapper to call translate service with raw content and title.
    on_jp_paragraphs_ready(list) được gọi ngay sau format+split để save content_jp_paragrap_list vào DB.
    on_vn_paragraphs_ready(list) được gọi sau khi dịch xong từng đoạn (content_vn_paragrap_list, map 1:1).
    Returns (content_jp_paragrap_list, content_vn_paragrap_list).
    """
    from app.ai.translate_service import translate_and_format
    return translate_and_format(
        content, title,
        on_jp_paragraphs_ready=on_jp_paragraphs_ready,
        on_vn_paragraphs_ready=on_vn_paragraphs_ready,
    )


def run_translate_paragraphs(limit: int = 0) -> int:
    """
    Dịch từng đoạn cho bài đã có content_jp_paragrap_list nhưng chưa có content_vn_paragrap_list.
    Gọi translate_content_from_paragraph_list (Ollama), lưu content_vn_paragrap_list (map 1:1).

    Cách gọi từ terminal: python run.py translate-para [--limit N]
    """
    from app.config import ENABLE_TRANSLATION

    if not ENABLE_TRANSLATION:
        print("Translation is disabled (ENABLE_TRANSLATION=False).")
        return 0

    col = get_articles_collection()
    query = {
        "content_jp_paragrap_list": {"$exists": True, "$ne": None, "$type": "array"},
        "$or": [
            {"content_vn_paragrap_list": None},
            {"content_vn_paragrap_list": {"$exists": False}},
            {"content_vn_paragrap_list": []},
        ],
    }
    cursor = col.find(query)
    if limit > 0:
        cursor = cursor.limit(limit)
    articles = list(cursor)
    total = len(articles)

    if total == 0:
        print("No articles need paragraph translation (all have content_vn_paragrap_list or no content_jp_paragrap_list).")
        return 0

    print(f"Found {total} articles to translate (paragraph by paragraph).")
    done = 0
    for i, doc in enumerate(articles):
        doc_id = doc["_id"]
        title = (doc.get("title") or "")[:80]
        content_jp_paragrap_list = doc.get("content_jp_paragrap_list") or []
        if not content_jp_paragrap_list:
            continue
        content_vn_paragrap_list = translate_content_from_paragraph_list(content_jp_paragrap_list, title)
        timestamp = datetime.now().strftime("%H:%M:%S")
        if content_vn_paragrap_list:
            col.update_one(
                {"_id": doc_id},
                {"$set": {"content_vn_paragrap_list": content_vn_paragrap_list}},
            )
            done += 1
            print(f"[{i+1}/{total}] [{timestamp}] ✓ {title}... ({len(content_vn_paragrap_list)} paragraphs)")
        else:
            print(f"[{i+1}/{total}] [{timestamp}] ✗ {title}...")
    print(f"\nCompleted: {done}/{total} articles (translate paragraphs).")
    return done


def run_format_japanese(limit: int = 0) -> int:
    """
    Format nội dung tiếng Nhật cho các bài có content nhưng chưa có content_jp_paragrap_list
    (hoặc list rỗng). Chỉ format + split, lưu content_jp_paragrap_list vào DB, không dịch.

    Args:
        limit: Số bài tối đa (0 = không giới hạn).

    Returns:
        Số bài đã format và lưu content_jp_paragrap_list.
    """
    from app.ai.translate_service import format_japanese_content, filter_jp_paragraph_list_for_save

    col = get_articles_collection()
    query = {
        "content": {"$ne": None, "$exists": True},
        "$or": [
            {"content_jp_paragrap_list": {"$exists": False}},
            {"content_jp_paragrap_list": None},
            {"content_jp_paragrap_list": []},
        ],
    }
    cursor = col.find(query)
    if limit > 0:
        cursor = cursor.limit(limit)
    articles = list(cursor)
    total = len(articles)

    if total == 0:
        print("No articles need format Japanese (all have content_jp_paragrap_list).")
        return 0

    print(f"Found {total} articles to format Japanese.")
    done = 0
    for i, doc in enumerate(articles):
        content = doc.get("content", "") or ""
        doc_id = doc["_id"]
        title = (doc.get("title") or "")[:50]
        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted_full, content_jp_paragrap_list = format_japanese_content(content)
        content_jp_paragrap_list = filter_jp_paragraph_list_for_save(content_jp_paragrap_list)
        col.update_one(
            {"_id": doc_id},
            {"$set": {"content_jp_paragrap_list": content_jp_paragrap_list}},
        )
        done += 1
        n = len(content_jp_paragrap_list)
        status = "✓" if formatted_full else "○"
        print(f"[{i+1}/{total}] [{timestamp}] {status} {title}... (paragraphs={n})")

    print(f"\nCompleted: {done}/{total} articles (content_jp_paragrap_list saved).")
    return done


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
    """Return True if title_vn and content_vn_paragrap_list are both non-null (list non-empty)."""
    title_vn = doc.get("title_vn")
    content_vn_paragrap_list = doc.get("content_vn_paragrap_list")
    return (
        title_vn is not None
        and title_vn != ""
        and content_vn_paragrap_list is not None
        and isinstance(content_vn_paragrap_list, list)
        and len(content_vn_paragrap_list) > 0
    )


def set_is_show_for_article(article_id) -> bool:
    """
    If title_vn and content_vn_paragrap_list are both non-null (list non-empty), set isShow = True.
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
    For all articles where title_vn and content_vn_paragrap_list are both non-null (list non-empty),
    set isShow = True. Returns number of documents updated.
    """
    col = get_articles_collection()
    query = {
        "title_vn": {"$exists": True, "$nin": [None, ""]},
        "content_vn_paragrap_list": {"$exists": True, "$ne": None, "$type": "array"},
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
