"""Translation and formatting service using Ollama."""
import re
from datetime import datetime
from typing import Callable, Optional
from ollama import Client


def paragraphs_from_text(text: str) -> list[str]:
    """
    Chia nội dung thành list các paragraph (theo \\n\\n). Dùng để lưu content_jp_paragrap_list
    và sau này map 1-1 với content_vn_paragrap_list.
    """
    if not text or not text.strip():
        return []
    return [p.strip() for p in text.split("\n\n") if p.strip()]

from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL, ENABLE_TRANSLATION

# Chunking: mỗi chunk tối đa bao nhiêu ký tự để phù hợp context qwen3:8b
MAX_CHARS_PER_CHUNK = 3500

# Không lưu các paragraph cuối nếu thuộc paywall/ghi chú (bỏ trước khi save).
# - "この記事は有料記事です。" / "（全文": có khi tách thành 2 đoạn ("この記事は有料記事です。" rồi "残り1828文字（全文2941文字）")
#   nên phải lặp xóa last và cần cả "（全文" để xóa luôn đoạn thứ hai.
JP_SAVE_DROP_LAST_IF_CONTAINS = ("【時系列で見る】", "この記事は有料記事です。", "（全文")


def filter_jp_paragraph_list_for_save(lst: list[str]) -> list[str]:
    """
    Trước khi lưu: nếu paragraph tại last_index chứa paywall/ghi chú thì remove, lặp đến khi không còn.
    (Paywall có thể 2 đoạn: "この記事は有料記事です。" rồi "残り1828文字（全文2941文字）" nên cần lặp + marker "（全文".)
    """
    if not lst:
        return lst
    result = list(lst)
    while result:
        last_index = len(result) - 1
        last_content = (result[last_index] or "").strip()
        if not last_content:
            break
        if any(marker in last_content for marker in JP_SAVE_DROP_LAST_IF_CONTAINS):
            result.pop(last_index)
        else:
            break
    return result


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


def _contains_japanese(text: str) -> bool:
    """
    Return True if text contains Japanese characters (Hiragana, Katakana, or Kanji).
    Used to ensure content_vn_paragrap_list is 100% Vietnamese.
    """
    if not text or not text.strip():
        return False
    # Hiragana: \u3040-\u309f, Katakana: \u30a0-\u30ff, CJK Unified Ideographs (Kanji): \u4e00-\u9faf
    for ch in text:
        if (
            "\u3040" <= ch <= "\u309f"
            or "\u30a0" <= ch <= "\u30ff"
            or "\u4e00" <= ch <= "\u9faf"
        ):
            return True
    return False


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


def translate_content_from_paragraph_list(
    content_jp_paragrap_list: list[str],
    title: str = "",
) -> list[str]:
    """
    Dịch từng đoạn trong content_jp_paragrap_list sang tiếng Việt bằng Ollama (tuần tự).
    Map 1:1: content_vn_paragrap_list[i] = bản dịch của content_jp_paragrap_list[i].
    Bản dịch chủ yếu tiếng Việt; có thể còn chữ Nhật khi model giữ tên công ty/địa danh theo yêu cầu.
    Đoạn rỗng hoặc dịch lỗi sẽ là chuỗi rỗng "" tại index tương ứng.
    """
    if not content_jp_paragrap_list:
        return []
    _only_output = "Chỉ trả về đúng bản dịch, không giải thích, không bình luận, không hỏi lại."
    _keep_format = "Giữ nguyên format của đoạn gốc: cùng số dòng, gạch đầu dòng, tiêu đề (##), danh sách đánh số — chỉ dịch nội dung, không thay đổi cấu trúc."
    _vietnamese_only = "Bắt buộc: Kết quả phải 100% tiếng Việt. Không được để lại bất kỳ chữ tiếng Nhật (kanji, hiragana, katakana) nào trong bản dịch — mọi nội dung đều phải được dịch sang tiếng Việt."
    content_vn_paragrap_list: list[str] = []
    total = len(content_jp_paragrap_list)
    for i, jp_para in enumerate(content_jp_paragrap_list):
        if not jp_para or not jp_para.strip():
            content_vn_paragrap_list.append("")
            continue
        preview = (jp_para.strip()[:60] + "…") if len(jp_para.strip()) > 60 else jp_para.strip()
        print(f"[Translate] Paragraph {i + 1}/{total}: {preview}")
        prompt = f"""Dịch đoạn văn sau từ tiếng Nhật sang tiếng Việt. Giữ nguyên tên riêng, địa danh, tên công ty. {_keep_format} {_vietnamese_only} {_only_output}
"""
        if title and i == 0:
            prompt += f"\nTiêu đề: {title}\n\n"
        prompt += f"Nội dung cần dịch:\n{jp_para.strip()}"
        out = _call_ollama(prompt)
        if out:
            out = _strip_model_commentary(out)
            # Đảm bảo 100% tiếng Việt: nếu còn chữ Nhật thì retry tối đa 2 lần
            for _ in range(2):
                if not _contains_japanese(out):
                    break
                retry_prompt = f"""Bản dịch trước vẫn còn chữ tiếng Nhật. Nhiệm vụ: dịch toàn bộ đoạn sau từ tiếng Nhật sang tiếng Việt. Đầu ra bắt buộc 100% tiếng Việt, không được để lại bất kỳ ký tự tiếng Nhật (hiragana, katakana, kanji) nào. Chỉ trả về bản dịch tiếng Việt.

Đoạn tiếng Nhật cần dịch:
{jp_para.strip()}"""
                out_retry = _call_ollama(retry_prompt)
                if out_retry:
                    out_retry = _strip_model_commentary(out_retry)
                    if not _contains_japanese(out_retry):
                        out = out_retry
                        break
                    out = out_retry  # thử dùng bản retry cho lần sau
            # Cho phép giữ lại chữ Nhật nếu là tên công ty/địa danh (theo yêu cầu "Giữ nguyên tên riêng, địa danh, tên công ty"); không xóa đoạn
            content_vn_paragrap_list.append(out)
        else:
            content_vn_paragrap_list.append("")
    return content_vn_paragrap_list


def translate_title_and_summary(title: str, summary: Optional[str] = None) -> tuple[Optional[str], Optional[str]]:
    """
    Translate title to Vietnamese. Summary is not translated — returned unchanged when provided.
    Returns (title_vn, summary_vn). summary_vn is the original summary unchanged; title_vn can be None if translation failed.
    """
    if not ENABLE_TRANSLATION:
        return (None, None)
    title_vn = translate_short_text(title) if title else None
    # Do not translate summary: keep original for display/storage
    summary_vn = summary if summary else None
    return (title_vn, summary_vn)


def translate_to_vietnamese(content: str, title: str = "") -> Optional[str]:
    """
    Dịch nội dung tiếng Nhật (có thể đã qua format_japanese_content) sang tiếng Việt.
    Giữ tên riêng, địa danh, tên công ty. Nội dung dài được chia theo paragraph, dịch từng chunk rồi nối lại.
    """
    if not content:
        return None

    chunks = _chunk_by_paragraphs(content, MAX_CHARS_PER_CHUNK)
    # Instruction to prevent model from adding commentary, questions, or suggestions
    _only_output = "Chỉ trả về đúng bản dịch, không giải thích, không bình luận, không hỏi lại, không gợi ý (summary/format/clarify). Nếu nội dung lặp hoặc dài, vẫn chỉ xuất bản dịch."

    if len(chunks) == 1:
        prompt = f"""Dịch toàn bộ nội dung sau từ tiếng Nhật sang tiếng Việt. Giữ nguyên tên riêng, địa danh, tên công ty. {_only_output}

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
            prompt = f"""Đây là {part_label} của một bài viết. Nhiệm vụ: DỊCH toàn bộ nội dung dưới đây từ tiếng Nhật sang tiếng Việt. Đây là đoạn văn nguồn cần dịch, KHÔNG phải câu hỏi của người dùng, KHÔNG phải dữ liệu cần phân tích. Giữ nguyên tên riêng, địa danh, tên công ty. {_only_output}

Tiêu đề: {title}

Nội dung cần dịch:
{chunk}"""
        else:
            prompt = f"""Đây là {part_label} của cùng một bài viết. Nhiệm vụ: DỊCH tiếp nội dung dưới đây từ tiếng Nhật sang tiếng Việt. Đây là đoạn văn nguồn (ví dụ: tin tức, bảng số liệu, danh sách) — chỉ cần dịch nguyên văn, KHÔNG giải thích, KHÔNG phân tích, KHÔNG trả lời như thể đây là câu hỏi. {_only_output}

Nội dung cần dịch:
{chunk}"""
        part = _call_ollama(prompt)
        if part is None:
            return None
        translated_parts.append(_strip_model_commentary(part))

    return "\n\n".join(translated_parts)


# --- Format tiếng Nhật (trước khi dịch): chia đoạn rõ ràng, giữ nguyên tiếng Nhật ---
FORMAT_JAPANESE_INSTRUCTIONS = """以下の日本語の文章を整形してください。
要件:
1. 内容はそのまま日本語で、翻訳しないでください。
2. 段落を明確に分け、段落と段落の間は空行1行で区切ってください。
3. 見出しやリストがある場合は適切に改行・区切りを入れてください。
4. 内容の意味や表現は変更せず、段落分けと読みやすさだけを整えてください。
出力は整形した日本語の文章のみ。説明やコメントは不要です。

文章:
"""


def format_japanese_content(content: str) -> tuple[Optional[str], list[str]]:
    """
    Format nội dung tiếng Nhật: chia thành các paragraph rõ ràng, giữ nguyên tiếng Nhật.
    Dùng Ollama. Nội dung dài được chunk theo paragraph, format từng chunk rồi nối lại
    thành một đoạn dài; từ đoạn dài đó mới split (theo \\n\\n) ra content_jp_paragrap_list.

    Returns:
        (formatted_content, content_jp_paragrap_list) — chuỗi đã format và list từng đoạn JP
        để lưu DB, sau này dịch từng đoạn: content_jp_paragrap_list[i] -> content_vn_paragrap_list[i].
    """
    if not content or not content.strip():
        return (None, [])

    chunks = _chunk_by_paragraphs(content.strip(), MAX_CHARS_PER_CHUNK)
    if len(chunks) == 1:
        out = _call_ollama(FORMAT_JAPANESE_INSTRUCTIONS + chunks[0])
        formatted_full = _strip_model_commentary(out) if out else None
        if formatted_full is None:
            return (None, paragraphs_from_text(content.strip()))
        # Sau khi format xong: từ đoạn dài mới split ra list
        content_jp_paragrap_list = paragraphs_from_text(formatted_full)
        return (formatted_full, content_jp_paragrap_list)

    num_chunks = len(chunks)
    print(f"[Format JA] Long content: splitting into {num_chunks} paragraph chunks (max {MAX_CHARS_PER_CHUNK} chars each).")
    formatted_parts: list[str] = []
    part_label_prefix = "[同じ文章の一部です。この部分だけを整形し、段落を明確に分けてください。翻訳せず日本語のまま出力。]\n\n"
    for i, chunk in enumerate(chunks):
        part_label = f"[部分 {i + 1}/{num_chunks}]\n\n" if i > 0 else ""
        prompt = FORMAT_JAPANESE_INSTRUCTIONS + part_label_prefix + part_label + chunk
        part = _call_ollama(prompt)
        if part is None:
            return (None, paragraphs_from_text(content.strip()))
        formatted_parts.append(_strip_model_commentary(part))
    # Nối lại thành đoạn dài, rồi từ đoạn dài đó mới split ra content_jp_paragrap_list
    formatted_full = "\n\n".join(formatted_parts)
    content_jp_paragrap_list = paragraphs_from_text(formatted_full)
    return (formatted_full, content_jp_paragrap_list)


def translate_and_format(
    content: str,
    title: str = "",
    on_jp_paragraphs_ready: Optional[Callable[[list[str]], None]] = None,
    on_vn_paragraphs_ready: Optional[Callable[[list[str]], None]] = None,
) -> tuple[list[str], list[str]]:
    """
    Bước 0: Format nội dung tiếng Nhật (chia paragraph rõ ràng, giữ nguyên tiếng Nhật).
    Gọi on_jp_paragraphs_ready(content_jp_paragrap_list) ngay sau format+split để caller có thể save vào DB.
    Bước 1: Dịch từng đoạn trong content_jp_paragrap_list bằng Ollama (map 1:1 -> content_vn_paragrap_list).
    Gọi on_vn_paragraphs_ready(content_vn_paragrap_list) để caller save vào DB.

    Returns:
        (content_jp_paragrap_list, content_vn_paragrap_list).
    """
    if not ENABLE_TRANSLATION or not content:
        return ([], [])

    started_at = datetime.now().isoformat()
    print(f"[{started_at}] Format JA (step 0) | model={OLLAMA_MODEL} | content_len={len(content)}")
    content_to_translate, content_jp_paragrap_list = format_japanese_content(content)
    if content_to_translate is None:
        content_to_translate = content
        content_jp_paragrap_list = paragraphs_from_text(content.strip())
        print(f"[{datetime.now().isoformat()}] Step 0 skipped (format failed), using original content.")
    else:
        print(f"[{datetime.now().isoformat()}] Step 0 done. Japanese content formatted (paragraphs={len(content_jp_paragrap_list)}).")

    # Không lưu paragraph cuối nếu nội dung từ "【時系列で見る】" / "この記事は有料記事です。" trở đi
    content_jp_paragrap_list = filter_jp_paragraph_list_for_save(content_jp_paragrap_list)

    # Save content_jp_paragrap_list vào DB ngay sau format+split (trước khi dịch)
    if on_jp_paragraphs_ready is not None:
        on_jp_paragraphs_ready(content_jp_paragrap_list)

    print(f"[{datetime.now().isoformat()}] Translating (step 1) — {len(content_jp_paragrap_list)} paragraphs, map 1:1...")
    content_vn_paragrap_list = translate_content_from_paragraph_list(content_jp_paragrap_list, title)
    if not content_vn_paragrap_list:
        return (content_jp_paragrap_list, content_vn_paragrap_list)

    if on_vn_paragraphs_ready is not None:
        on_vn_paragraphs_ready(content_vn_paragrap_list)

    print(f"[{datetime.now().isoformat()}] Step 1 done.")
    return (content_jp_paragrap_list, content_vn_paragrap_list)


def translate_article_content(
    article,
    on_jp_paragraphs_ready: Optional[Callable[[list[str]], None]] = None,
    on_vn_paragraphs_ready: Optional[Callable[[list[str]], None]] = None,
) -> tuple[list[str], list[str]]:
    """
    Translate article content to Vietnamese.
    on_jp_paragraphs_ready: gọi ngay sau format+split với content_jp_paragrap_list (để save DB).
    on_vn_paragraphs_ready: gọi sau khi dịch xong từng đoạn với content_vn_paragrap_list (map 1:1).

    Returns:
        (content_jp_paragrap_list, content_vn_paragrap_list).
    """
    if not article.content:
        return ([], [])
    return translate_and_format(
        article.content,
        article.title,
        on_jp_paragraphs_ready=on_jp_paragraphs_ready,
        on_vn_paragraphs_ready=on_vn_paragraphs_ready,
    )
