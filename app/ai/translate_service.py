"""Translation and formatting service using Ollama."""
import re
from datetime import datetime
from typing import Optional
from ollama import Client

from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL, ENABLE_TRANSLATION

# Chỉ chạy step 2 (format) khi bản dịch đủ dài; dưới ngưỡng này giữ nguyên bản dịch thô
MIN_LENGTH_FOR_FORMAT = 400
# Chunking: mỗi chunk tối đa bao nhiêu ký tự để phù hợp context qwen3:8b
MAX_CHARS_PER_CHUNK = 3500


def _call_ollama(prompt: str, max_retries: int = 2) -> Optional[str]:
    """Gửi prompt tới Ollama và trả về nội dung phản hồi. Retry khi lỗi tạm thời."""
    client = Client(host=OLLAMA_BASE_URL)
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            response = client.chat(
                model=OLLAMA_MODEL,
                messages=[{'role': 'user', 'content': prompt}],
            )
            out = (response.message.content or "").strip()
            return out if out else None
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                print(f"[Ollama] Attempt {attempt + 1} failed: {e}. Retrying...")
    print(f"[Ollama] Error after {max_retries + 1} attempts: {last_error}")
    return None


def _strip_model_commentary(text: str) -> str:
    """
    Remove common model meta-commentary (e.g. "It seems the text...", "Could you clarify?",
    "Hãy cho mình biết thêm nhé") that can appear when using multiple chunks.
    Strips from the first offending paragraph to the end of the chunk.
    """
    if not text or len(text.strip()) < 50:
        return text
    markers = [
        r"it\s+seems\s+(the\s+)?text\s+you\s+provided",
        r"it\s+seems\s+like\s+you",
        r"could\s+you\s+clarify",
        r"clarify\s+what\s+you\s+need",
        r"if\s+you['\u2019]d\s+like\s*,\s*i\s+can\s*:",
        r"let\s+me\s+know\s*!",
        r"dường\s+như\s+bạn\s+đang\s+cố\s+gắng",
        r"hãy\s+cho\s+mình\s+biết\s+thêm\s+nhé",
        r"^\s*##\s+Ví dụ\s*$",
        r"cryptocurrency\s+holdings",
        r"listing\s+cryptocurrency",
        r"^\s*##\s*Phân\s+trích\s+số\s+liệu",
        r"phân\s+trích\s+số\s+liệu",
        r"dãy\s+số\s+có\s+vẻ",
        r"repeated\s+[\"']?D[\"']?\s+character",
        r"message\s+consisting\s+of\s+repeated",
        r"Đề\s+bài\s*:\s*Người\s+dùng",
    ]
    paragraphs = text.split("\n\n")
    keep: list[str] = []
    for p in paragraphs:
        p_stripped = p.strip()
        if not p_stripped:
            keep.append(p)
            continue
        p_lower = p_stripped.lower()
        p_first_line = (p_stripped.split("\n")[0] or "").strip().lower()
        found = False
        for m in markers:
            if re.search(m, p_lower, re.IGNORECASE) or re.search(m, p_first_line, re.IGNORECASE):
                found = True
                break
        if found:
            break
        keep.append(p)
    return "\n\n".join(keep).strip() or text


def _chunk_by_paragraphs(text: str, max_chars: int = MAX_CHARS_PER_CHUNK) -> list[str]:
    """
    Chia nội dung theo đoạn (paragraph). Mỗi chunk = một hoặc nhiều đoạn, không vượt max_chars.
    Đoạn được xác định bởi \\n\\n (hai xuống dòng).
    """
    if not text or len(text.strip()) <= max_chars:
        return [text.strip()] if text and text.strip() else []

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return [text[:max_chars]] if text else []

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    sep_len = 2  # "\n\n"

    for p in paragraphs:
        p_len = len(p) + (sep_len if current else 0)
        if current_len + p_len > max_chars and current:
            chunks.append("\n\n".join(current))
            current = [p]
            current_len = len(p)
        else:
            current.append(p)
            current_len += p_len

    if current:
        chunks.append("\n\n".join(current))
    return chunks


def translate_short_text(text: str) -> Optional[str]:
    """
    Translate a short text (e.g. title or summary) to Vietnamese.
    Single prompt, no chunking. Keeps proper nouns.
    """
    if not text or not text.strip():
        return None
    prompt = f"""Dịch sang tiếng Việt. Giữ nguyên tên riêng, địa danh, tên công ty. Chỉ trả về bản dịch, không giải thích.

{text.strip()}"""
    return _call_ollama(prompt)


def translate_title_and_summary(title: str, summary: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """
    Translate title and summary to Vietnamese.
    Returns (title_vn, summary_vn). Either can be None if translation failed or input was empty.
    """
    if not ENABLE_TRANSLATION:
        return (None, None)
    title_vn = translate_short_text(title) if title else None
    summary_vn = translate_short_text(summary) if summary else None
    return (title_vn, summary_vn)


def translate_to_vietnamese(content: str, title: str = "") -> Optional[str]:
    """
    Bước 1: Dịch 100% sang tiếng Việt (giữ tên riêng, địa danh, tên công ty).
    Nội dung dài được chia theo paragraph, dịch từng chunk rồi nối lại.
    """
    if not content:
        return None

    chunks = _chunk_by_paragraphs(content, MAX_CHARS_PER_CHUNK)
    # Instruction to prevent model from adding commentary, questions, or suggestions
    _only_output = "Chỉ trả về đúng bản dịch, không giải thích, không bình luận, không hỏi lại, không gợi ý (summary/format/clarify). Nếu nội dung lặp hoặc dài, vẫn chỉ xuất bản dịch."

    if len(chunks) == 1:
        prompt = f"""Dịch toàn bộ nội dung sau sang tiếng Việt. Giữ nguyên tên riêng, địa danh, tên công ty. {_only_output}

Tiêu đề: {title}

Nội dung:
{chunks[0]}"""
        out = _call_ollama(prompt)
        return _strip_model_commentary(out) if out else None

    # Nhiều chunk: dịch lần lượt, chunk đầu kèm title
    num_chunks = len(chunks)
    print(f"[Translate] Long content: splitting into {num_chunks} paragraph chunks (max {MAX_CHARS_PER_CHUNK} chars each).")
    translated_parts: list[str] = []
    for i, chunk in enumerate(chunks):
        part_label = f"Phần {i + 1}/{num_chunks}"
        if i == 0:
            prompt = f"""Đây là {part_label} của một bài viết. Nhiệm vụ: DỊCH toàn bộ nội dung dưới đây từ tiếng Anh sang tiếng Việt. Đây là đoạn văn nguồn cần dịch, KHÔNG phải câu hỏi của người dùng, KHÔNG phải dữ liệu cần phân tích. Giữ nguyên tên riêng, địa danh, tên công ty. {_only_output}

Tiêu đề: {title}

Nội dung cần dịch:
{chunk}"""
        else:
            prompt = f"""Đây là {part_label} của cùng một bài viết. Nhiệm vụ: DỊCH tiếp nội dung dưới đây từ tiếng Anh sang tiếng Việt. Đây là đoạn văn nguồn (ví dụ: tin tức, bảng số liệu, danh sách) — chỉ cần dịch nguyên văn, KHÔNG giải thích, KHÔNG phân tích, KHÔNG trả lời như thể đây là câu hỏi. {_only_output}

Nội dung cần dịch:
{chunk}"""
        part = _call_ollama(prompt)
        if part is None:
            return None
        translated_parts.append(_strip_model_commentary(part))

    return "\n\n".join(translated_parts)


FORMAT_INSTRUCTIONS = """Format lại nội dung tiếng Việt sau theo yêu cầu:
1. Chia thành các đoạn văn rõ ràng, mỗi đoạn cách nhau 1 dòng trống
2. Dùng gạch đầu dòng (•) cho danh sách hoặc điểm quan trọng
3. In đậm (**text**) cho từ khóa hoặc thuật ngữ quan trọng
4. Dùng tiêu đề phụ (## Tiêu đề) nếu nội dung dài, có nhiều phần
Chỉ trả về nội dung đã format, không giải thích, không bình luận, không hỏi lại, không gợi ý. Nếu nội dung lặp hoặc ngắn, vẫn chỉ xuất phần đã format.

Nội dung:
"""


def format_vietnamese_content(content: str) -> Optional[str]:
    """
    Bước 2: Format nội dung tiếng Việt (đoạn văn, gạch đầu dòng, in đậm, tiêu đề phụ).
    Nội dung dài được chia theo paragraph, format từng chunk rồi nối lại.
    """
    if not content:
        return None

    chunks = _chunk_by_paragraphs(content, MAX_CHARS_PER_CHUNK)
    if len(chunks) == 1:
        out = _call_ollama(FORMAT_INSTRUCTIONS + chunks[0])
        return _strip_model_commentary(out) if out else None

    num_chunks = len(chunks)
    print(f"[Format] Long content: splitting into {num_chunks} paragraph chunks (max {MAX_CHARS_PER_CHUNK} chars each).")
    formatted_parts: list[str] = []
    for i, chunk in enumerate(chunks):
        part_label = f"[Phần {i + 1}/{num_chunks} của nội dung tiếng Việt, chỉ format đoạn này.]\n\n"
        part = _call_ollama(FORMAT_INSTRUCTIONS + part_label + chunk)
        if part is None:
            return None
        formatted_parts.append(_strip_model_commentary(part))
    return "\n\n".join(formatted_parts)


def translate_and_format(content: str, title: str = "") -> Optional[str]:
    """
    Dịch sang tiếng Việt (step 1) rồi format (step 2) để giảm tải prompt cho model nhỏ.
    """
    if not ENABLE_TRANSLATION or not content:
        return None

    started_at = datetime.now().isoformat()
    print(f"[{started_at}] Translating (step 1) | model={OLLAMA_MODEL} | content_len={len(content)}")

    translated = translate_to_vietnamese(content, title)
    if not translated:
        return None

    # Nội dung ngắn: bỏ qua step 2 để tiết kiệm thời gian
    if len(translated.strip()) < MIN_LENGTH_FOR_FORMAT:
        print(f"[{datetime.now().isoformat()}] Step 1 done. Skipping format (content short).")
        return translated

    print(f"[{datetime.now().isoformat()}] Step 1 done. Formatting (step 2)...")
    formatted = format_vietnamese_content(translated)
    if formatted is not None:
        print(f"[{datetime.now().isoformat()}] Translated and formatted successfully.")
        return formatted
    # Nếu step 2 lỗi, vẫn trả về bản dịch thô
    return translated


def translate_article_content(article) -> Optional[str]:
    """
    Translate article content to Vietnamese.
    
    Args:
        article: Article object with content and title
    
    Returns:
        Formatted Vietnamese content
    """
    if not article.content:
        return None
    
    return translate_and_format(article.content, article.title)
